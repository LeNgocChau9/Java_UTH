package com.example.livingdocs_backend.infrastructure.parser;

import lombok.extern.slf4j.Slf4j;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Bộ phân giải tài liệu Microsoft Word (.docx) sang chuẩn Markdown (GFM).
 * Sử dụng thuần túy Java 17 (ZipInputStream + DOM Parser) - Zero External Dependencies.
 */
@Slf4j
public class DocxToMarkdownParser {

    /**
     * Chuyển đổi luồng byte của file .docx thành chuỗi Markdown.
     *
     * @param inputStream Luồng dữ liệu của file .docx
     * @return Chuỗi nội dung định dạng Markdown
     */
    public static String parseDocxToMarkdown(InputStream inputStream) {
        if (inputStream == null) {
            throw new IllegalArgumentException("Dữ liệu file .docx không được để trống");
        }

        try (ZipInputStream zis = new ZipInputStream(inputStream)) {
            ZipEntry entry;
            byte[] documentXmlBytes = null;

            while ((entry = zis.getNextEntry()) != null) {
                String entryName = entry.getName().replace('\\', '/').toLowerCase();
                if (entryName.endsWith("word/document.xml")) {
                    documentXmlBytes = zis.readAllBytes();
                    break;
                }
            }

            if (documentXmlBytes == null || documentXmlBytes.length == 0) {
                throw new IllegalArgumentException("Tệp tin không đúng định dạng .docx hợp lệ (không tìm thấy thành phần word/document.xml)");
            }

            return convertXmlToMarkdown(documentXmlBytes);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi khi phân giải file .docx sang Markdown: {}", e.getMessage(), e);
            throw new IllegalArgumentException("Không thể đọc và chuyển đổi tệp tin Word (.docx): " + e.getMessage(), e);
        }
    }

    private static String convertXmlToMarkdown(byte[] xmlBytes) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        try {
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        } catch (Throwable ignored) {
            // bỏ qua nếu parser JRE không hỗ trợ cờ apache xerces này
        }
        dbf.setNamespaceAware(true);

        DocumentBuilder db = dbf.newDocumentBuilder();
        Document doc = db.parse(new ByteArrayInputStream(xmlBytes));
        doc.getDocumentElement().normalize();

        Node bodyNode = doc.getElementsByTagNameNS("*", "body").item(0);
        if (bodyNode == null) {
            bodyNode = doc.getElementsByTagName("w:body").item(0);
        }
        if (bodyNode == null) {
            return "";
        }

        StringBuilder markdown = new StringBuilder();
        NodeList children = bodyNode.getChildNodes();

        for (int i = 0; i < children.getLength(); i++) {
            Node child = children.item(i);
            if (child.getNodeType() != Node.ELEMENT_NODE) {
                continue;
            }

            String localName = child.getLocalName();
            if (localName == null) {
                localName = child.getNodeName();
            }

            if (localName.endsWith("p") || "p".equals(localName)) {
                String pText = parseParagraph((Element) child);
                if (pText != null && !pText.isBlank()) {
                    markdown.append(pText).append("\n\n");
                }
            } else if (localName.endsWith("tbl") || "tbl".equals(localName)) {
                String tblText = parseTable((Element) child);
                if (tblText != null && !tblText.isBlank()) {
                    markdown.append(tblText).append("\n\n");
                }
            }
        }

        return markdown.toString().trim();
    }

    private static String parseParagraph(Element pElem) {
        String headingPrefix = "";
        boolean isBullet = false;

        // 1. Kiểm tra thuộc tính heading hoặc bullet trong <w:pPr>
        NodeList pPrList = pElem.getElementsByTagNameNS("*", "pPr");
        if (pPrList.getLength() > 0) {
            Element pPr = (Element) pPrList.item(0);

            // Kiểm tra heading style
            NodeList pStyleList = pPr.getElementsByTagNameNS("*", "pStyle");
            if (pStyleList.getLength() > 0) {
                Element pStyle = (Element) pStyleList.item(0);
                String val = pStyle.getAttributeNS("*", "val");
                if (val == null || val.isBlank()) {
                    val = pStyle.getAttribute("w:val");
                }
                if (val != null) {
                    val = val.toLowerCase();
                    if (val.contains("heading1") || val.contains("tieude1") || val.equals("1")) {
                        headingPrefix = "# ";
                    } else if (val.contains("heading2") || val.contains("tieude2") || val.equals("2")) {
                        headingPrefix = "## ";
                    } else if (val.contains("heading3") || val.contains("tieude3") || val.equals("3")) {
                        headingPrefix = "### ";
                    } else if (val.contains("heading4") || val.contains("tieude4") || val.equals("4")) {
                        headingPrefix = "#### ";
                    }
                }
            }

            // Kiểm tra danh sách (bullet / number)
            NodeList numPrList = pPr.getElementsByTagNameNS("*", "numPr");
            if (numPrList.getLength() > 0 && headingPrefix.isEmpty()) {
                isBullet = true;
            }
        }

        // 2. Gom các text run <w:r>
        StringBuilder sb = new StringBuilder();
        NodeList rList = pElem.getElementsByTagNameNS("*", "r");

        for (int i = 0; i < rList.getLength(); i++) {
            Element r = (Element) rList.item(i);
            boolean isBold = false;
            boolean isItalic = false;
            boolean isCode = false;

            NodeList rPrList = r.getElementsByTagNameNS("*", "rPr");
            if (rPrList.getLength() > 0) {
                Element rPr = (Element) rPrList.item(0);
                if (rPr.getElementsByTagNameNS("*", "b").getLength() > 0) {
                    isBold = true;
                }
                if (rPr.getElementsByTagNameNS("*", "i").getLength() > 0) {
                    isItalic = true;
                }
                NodeList rFontsList = rPr.getElementsByTagNameNS("*", "rFonts");
                if (rFontsList.getLength() > 0) {
                    Element rFonts = (Element) rFontsList.item(0);
                    String fontAscii = rFonts.getAttributeNS("*", "ascii");
                    if (fontAscii == null || fontAscii.isBlank()) {
                        fontAscii = rFonts.getAttribute("w:ascii");
                    }
                    if (fontAscii != null && (fontAscii.toLowerCase().contains("consolas") || fontAscii.toLowerCase().contains("courier"))) {
                        isCode = true;
                    }
                }
            }

            // Lấy nội dung text trong <w:t>
            NodeList tList = r.getElementsByTagNameNS("*", "t");
            for (int j = 0; j < tList.getLength(); j++) {
                String text = tList.item(j).getTextContent();
                if (text != null && !text.isEmpty()) {
                    if (isCode && !text.isBlank()) {
                        sb.append("`").append(text).append("`");
                    } else if (isBold && !text.isBlank()) {
                        sb.append("**").append(text).append("**");
                    } else if (isItalic && !text.isBlank()) {
                        sb.append("*").append(text).append("*");
                    } else {
                        sb.append(text);
                    }
                }
            }

            // Xử lý xuống dòng mềm <w:br/>
            if (r.getElementsByTagNameNS("*", "br").getLength() > 0) {
                sb.append("\n");
            }
        }

        String content = sb.toString().trim();
        if (content.isEmpty()) {
            return "";
        }

        if (!headingPrefix.isEmpty()) {
            return headingPrefix + content;
        }
        if (isBullet) {
            return "- " + content;
        }
        return content;
    }

    private static String parseTable(Element tblElem) {
        NodeList trList = tblElem.getElementsByTagNameNS("*", "tr");
        if (trList.getLength() == 0) {
            return "";
        }

        List<List<String>> rows = new ArrayList<>();
        int maxCols = 0;

        for (int i = 0; i < trList.getLength(); i++) {
            Element tr = (Element) trList.item(i);
            NodeList tcList = tr.getElementsByTagNameNS("*", "tc");
            List<String> rowCells = new ArrayList<>();

            for (int j = 0; j < tcList.getLength(); j++) {
                Element tc = (Element) tcList.item(j);
                StringBuilder cellText = new StringBuilder();
                NodeList pList = tc.getElementsByTagNameNS("*", "p");
                for (int k = 0; k < pList.getLength(); k++) {
                    String p = parseParagraph((Element) pList.item(k));
                    if (!p.isEmpty()) {
                        if (cellText.length() > 0) {
                            cellText.append(" ");
                        }
                        cellText.append(p.replace("|", "\\|").replace("\n", " "));
                    }
                }
                rowCells.add(cellText.toString().trim());
            }

            if (!rowCells.isEmpty()) {
                rows.add(rowCells);
                maxCols = Math.max(maxCols, rowCells.size());
            }
        }

        if (rows.isEmpty() || maxCols == 0) {
            return "";
        }

        StringBuilder tableMd = new StringBuilder();
        // Header
        List<String> header = rows.get(0);
        tableMd.append("|");
        for (int j = 0; j < maxCols; j++) {
            String val = j < header.size() ? header.get(j) : "";
            tableMd.append(" ").append(val.isEmpty() ? " " : val).append(" |");
        }
        tableMd.append("\n|");

        // Separator
        for (int j = 0; j < maxCols; j++) {
            tableMd.append(" --- |");
        }
        tableMd.append("\n");

        // Body rows
        for (int i = 1; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            tableMd.append("|");
            for (int j = 0; j < maxCols; j++) {
                String val = j < row.size() ? row.get(j) : "";
                tableMd.append(" ").append(val.isEmpty() ? " " : val).append(" |");
            }
            tableMd.append("\n");
        }

        return tableMd.toString().trim();
    }
}


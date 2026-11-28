import { LampLoginClient } from "./LampLoginClient";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured:
    "Đăng nhập bằng GitHub chưa được cấu hình trên máy chủ. Vui lòng dùng email/mật khẩu.",
  access_denied: "Bạn đã hủy cấp quyền đăng nhập bằng GitHub.",
  oauth_state: "Phiên đăng nhập GitHub không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
  oauth_failed: "Đăng nhập bằng GitHub thất bại. Vui lòng thử lại.",
  account_rejected:
    "Yêu cầu đăng ký tài khoản của bạn đã bị Quản trị viên từ chối. Vui lòng liên hệ quản trị hệ thống.",
  account_locked:
    "Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ quản trị hệ thống.",
  account_disabled:
    "Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ quản trị hệ thống.",
  no_enterprise:
    "Tài khoản của bạn chưa được phân vào doanh nghiệp nào để liên kết GitHub. Vui lòng liên hệ Quản trị viên.",
};

const OAUTH_NOTICE_MESSAGES: Record<string, string> = {
  pending_approval:
    "Tài khoản GitHub của bạn đã được ghi nhận và đang chờ Quản trị viên phê duyệt. Vui lòng quay lại đăng nhập sau khi được duyệt.",
  account_pending:
    "Tài khoản của bạn đang chờ Quản trị viên phê duyệt. Vui lòng thử lại sau khi được duyệt.",
};

function oauthErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  if (code in OAUTH_NOTICE_MESSAGES) return undefined;
  return OAUTH_ERROR_MESSAGES[code] ?? "Đăng nhập bằng GitHub thất bại. Vui lòng thử lại.";
}

function oauthNoticeMessage(
  noticeCode: string | undefined,
  errorCode: string | undefined,
): string | undefined {
  if (noticeCode) {
    return (
      OAUTH_NOTICE_MESSAGES[noticeCode] ??
      "Tài khoản của bạn đang chờ Quản trị viên phê duyệt trước khi đăng nhập."
    );
  }
  if (errorCode && errorCode in OAUTH_NOTICE_MESSAGES) {
    return OAUTH_NOTICE_MESSAGES[errorCode];
  }
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const errorParam = typeof sp.error === "string" ? sp.error : undefined;
  const noticeParam = typeof sp.notice === "string" ? sp.notice : undefined;
  const initialError = oauthErrorMessage(errorParam);
  const initialNotice = oauthNoticeMessage(noticeParam, errorParam);

  return <LampLoginClient initialError={initialError} initialNotice={initialNotice} />;
}

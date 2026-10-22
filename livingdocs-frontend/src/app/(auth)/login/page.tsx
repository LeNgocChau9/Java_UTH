import { LampLoginClient } from "./LampLoginClient";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured:
    "Đăng nhập bằng GitHub chưa được cấu hình trên máy chủ. Vui lòng dùng email/mật khẩu.",
  access_denied: "Bạn đã hủy cấp quyền đăng nhập bằng GitHub.",
  oauth_state: "Phiên đăng nhập GitHub không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
  oauth_failed: "Đăng nhập bằng GitHub thất bại. Vui lòng thử lại.",
};

function oauthErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return OAUTH_ERROR_MESSAGES[code] ?? "Đăng nhập bằng GitHub thất bại. Vui lòng thử lại.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const initialError = oauthErrorMessage(typeof sp.error === "string" ? sp.error : undefined);

  return <LampLoginClient initialError={initialError} />;
}

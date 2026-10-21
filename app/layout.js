import "page-flip/src/Style/stPageFlip.css";
import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://cheongaram-expo.vercel.app"),
  title: "청아람어린이집 그림책 전시회",
  description: "놀면서 배우고 사랑으로 자라는 청아람어린이집 — 아이들이 만든 그림책을 동요와 함께 넘겨 보고 소감을 남겨요.",
  openGraph: {
    title: "청아람어린이집 그림책 전시회",
    description: "아이들이 만든 그림책을 동요와 함께 넘겨 보고 소감을 남겨요.",
    images: ["/og.jpg"],
  },
};

export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#2f9e57" };

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}

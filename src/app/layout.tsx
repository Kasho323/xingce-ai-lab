import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "行测思维实验室 · XingCe AI Lab",
  description: "让解题过程看得见。来源可追溯、答案可核验的个人行测学习实验室。",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

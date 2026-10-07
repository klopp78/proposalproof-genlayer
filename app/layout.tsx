import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProposalProof for GenLayer",
  description: "Consensus-backed governance proposal and execution verification on GenLayer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

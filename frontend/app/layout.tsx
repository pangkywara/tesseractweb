import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import I18nProviderComponent from "@/components/I18nProviderComponent"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Kelompok 3 OCR",
  description: "Interactive OCR application built with Next.js and FastAPI",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <I18nProviderComponent>
            {children}
          </I18nProviderComponent>
        </ThemeProvider>
      </body>
    </html>
  )
}

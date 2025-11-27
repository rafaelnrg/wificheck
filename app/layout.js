import "./globals.css";

export const metadata = {
  title: "WiFiCheck - Segurança da conexão",
  description:
    "Ferramenta simples para testar aspectos básicos de segurança e qualidade da sua conexão de rede.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}


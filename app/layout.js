import './globals.css';
import Shell from '@/components/Shell';

export const metadata = { title: 'Access Audit Engine', description: 'Enterprise Identity & RBAC Audit Engine' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}

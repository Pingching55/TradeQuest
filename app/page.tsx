import Link from 'next/link';
import { Button } from '@/components/ui/button';
import './landing.css';

export default function Home() {
  return (
    <div className="landing-page">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Trade Journal</h1>
        <p className="text-gray-600 mb-8">Track and analyze your trading performance</p>
        <Link href="/auth/login">
          <button className="custom-button">
            Get Started
          </button>
        </Link>
      </div>
    </div>
  );
}

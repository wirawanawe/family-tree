'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function Navbar() {
  const router = useRouter()
  const { user, loading: authLoading, logout } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = async () => {
    await logout()
    setIsMobileMenuOpen(false)
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white shadow-lg'
          : 'bg-white/95 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-3xl">🌳</span>
            <span className="text-xl font-bold text-gray-800">Family Tree</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              Beranda
            </Link>
            <Link
              href="/events"
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              Acara
            </Link>
            <Link
              href="/documentation"
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              Dokumentasi
            </Link>
            <Link
              href="/tree"
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              Pohon Keluarga
            </Link>
            {user ? (
              <div className="flex items-center space-x-4">
                <Link
                  href="/profile"
                  className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                >
                  👤 {user.name}
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 space-y-4 border-t border-gray-200">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-gray-700 hover:text-primary-600 font-medium"
            >
              Beranda
            </Link>
            <Link
              href="/events"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-gray-700 hover:text-primary-600 font-medium"
            >
              Acara
            </Link>
            <Link
              href="/documentation"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-gray-700 hover:text-primary-600 font-medium"
            >
              Dokumentasi
            </Link>
            <Link
              href="/tree"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-gray-700 hover:text-primary-600 font-medium"
            >
              Pohon Keluarga
            </Link>
            {user ? (
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <Link
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-sm text-gray-600 hover:text-primary-600"
                >
                  👤 {user.name}
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full text-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

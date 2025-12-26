'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import HeroSlider from '@/components/HeroSlider'

interface FamilyEvent {
  id: number
  title: string
  description?: string
  event_date: string
  event_time?: string
  location?: string
}

interface Documentation {
  id: number
  title: string
  description?: string
  file_type: 'photo' | 'video'
  file_url: string
  thumbnail_url?: string
  event_title?: string
  created_at: string
}

function DocumentationGallery() {
  const [docs, setDocs] = useState<Documentation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDocumentation()
  }, [])

  const fetchDocumentation = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/documentation?type=photo')
      const data = await response.json()
      // Get latest 6 photos
      setDocs(data.slice(0, 6))
    } catch (error) {
      console.error('Error fetching documentation:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Memuat dokumentasi...</div>
      </div>
    )
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-lg">
        <div className="text-6xl mb-4">📸</div>
        <p className="text-xl text-gray-600 mb-4">
          Belum ada dokumentasi foto
        </p>
        <Link
          href="/documentation"
          className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Lihat Galeri Lengkap
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group"
          >
            <div className="relative overflow-hidden">
              <img
                src={doc.file_url}
                alt={doc.title}
                className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-4xl">
                  👁️
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-2 line-clamp-2">
                {doc.title}
              </h3>
              {doc.event_title && (
                <p className="text-sm text-primary-600 mb-2">
                  📅 {doc.event_title}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {new Date(doc.created_at).toLocaleDateString('id-ID')}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <Link
          href="/documentation"
          className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-all transform hover:scale-105 shadow-lg"
        >
          Lihat Semua Dokumentasi →
        </Link>
      </div>
    </>
  )
}

export default function LandingPage() {
  const [upcomingEvents, setUpcomingEvents] = useState<FamilyEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUpcomingEvents()
  }, [])

  const fetchUpcomingEvents = async () => {
    try {
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth() + 1
      
      const response = await fetch(`/api/events?year=${year}&month=${month}`)
      if (!response.ok) {
        setUpcomingEvents([])
        return
      }
      const data = await response.json()
      const list = Array.isArray(data) ? data : []
      
      // Filter upcoming events (including today)
      const todayStr = formatDateLocal(today)
      const upcoming = list
        .filter((e: FamilyEvent) => {
          const eventDate = (e?.event_date || '').toString().split('T')[0].split(' ')[0]
          return eventDate && eventDate >= todayStr
        })
        .sort((a: FamilyEvent, b: FamilyEvent) => {
          const dateA = (a.event_date || '').toString().split('T')[0]
          const dateB = (b.event_date || '').toString().split('T')[0]
          return dateA.localeCompare(dateB)
        })
        .slice(0, 6) // Show only 6 upcoming events
      
      setUpcomingEvents(upcoming)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <>
      <Navbar />
      <div className="pt-16">
        {/* Hero Slider */}
        <HeroSlider />

        {/* Events Section */}
        <section id="events" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">
                📅 Acara Keluarga Mendatang
              </h2>
              <p className="text-xl text-gray-600">
                Lihat acara keluarga yang akan datang
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="text-gray-500">Memuat acara...</div>
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-xl text-gray-600 mb-4">
                  Belum ada acara yang dijadwalkan
                </p>
                <Link
                  href="/events"
                  className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Lihat Kalender Acara
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-blue-100"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-800 mb-2">
                            {event.title}
                          </h3>
                          <p className="text-sm text-primary-600 font-semibold">
                            📍 {formatDateDisplay(event.event_date)}
                          </p>
                          {event.event_time && (
                            <p className="text-sm text-gray-600 mt-1">
                              ⏰ {event.event_time}
                            </p>
                          )}
                          {event.location && (
                            <p className="text-sm text-gray-600 mt-1">
                              📌 {event.location}
                            </p>
                          )}
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-gray-700 mb-4 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <Link
                    href="/events"
                    className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-all transform hover:scale-105 shadow-lg"
                  >
                    Lihat Semua Acara →
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Documentation Section */}
        <section id="documentation" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">
                📸 Dokumentasi Keluarga
              </h2>
              <p className="text-xl text-gray-600">
                Galeri foto dan video acara keluarga
              </p>
            </div>

            {/* Documentation Gallery */}
            <DocumentationGallery />

            {/* Quick Start Guide */}
            <div className="mt-16 bg-white rounded-xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                🚀 Panduan Cepat
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">
                      Daftar atau Login
                    </h4>
                    <p className="text-gray-600">
                      Buat akun sebagai member untuk melihat pohon keluarga, 
                      atau daftar sebagai admin (perlu approval superadmin).
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">
                      Lihat Pohon Keluarga
                    </h4>
                    <p className="text-gray-600">
                      Jelajahi pohon keluarga dengan navigasi yang mudah. 
                      Klik anggota untuk melihat detail atau melihat anak-anak mereka.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">
                      Kelola Acara
                    </h4>
                    <p className="text-gray-600">
                      Tambahkan acara keluarga di kalender. 
                      Admin dapat membuat, mengedit, dan menghapus acara.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">
                      Tambah Anggota (Admin)
                    </h4>
                    <p className="text-gray-600">
                      Sebagai admin, Anda dapat menambah, mengedit, 
                      dan menghapus anggota keluarga.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-800 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-3xl">🌳</span>
                  <span className="text-xl font-bold">Family Tree</span>
                </div>
                <p className="text-gray-400">
                  Kelola dan visualisasikan pohon keluarga Anda dengan mudah.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Tautan Cepat</h4>
                <ul className="space-y-2 text-gray-400">
                  <li>
                    <Link href="/tree" className="hover:text-white transition-colors">
                      Pohon Keluarga
                    </Link>
                  </li>
                  <li>
                    <Link href="/events" className="hover:text-white transition-colors">
                      Acara Keluarga
                    </Link>
                  </li>
                  <li>
                    <Link href="/documentation" className="hover:text-white transition-colors">
                      Dokumentasi
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-white transition-colors">
                      Login / Daftar
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Kontak</h4>
                <p className="text-gray-400">
                  Untuk pertanyaan atau bantuan, silakan hubungi admin keluarga.
                </p>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-gray-700 text-center text-gray-400">
              <p>&copy; {new Date().getFullYear()} Family Tree. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

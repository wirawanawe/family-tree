'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/Navbar'

interface FamilyEvent {
  id: number
  title: string
  description?: string
  event_date: string
  event_time?: string
  location?: string
  created_by?: number
  created_at?: string
}

export default function EventsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<FamilyEvent | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    event_time: '',
    location: '',
  })
  const [loading, setLoading] = useState(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    fetchEvents()
  }, [year, month])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/events?year=${year}&month=${month + 1}`
      )
      const data = await response.json()
      // Normalize event dates to ensure YYYY-MM-DD format
      const normalizedData = data.map((e: FamilyEvent) => ({
        ...e,
        event_date: typeof e.event_date === 'string' 
          ? e.event_date.split('T')[0].split(' ')[0] 
          : e.event_date
      }))
      setEvents(normalizedData)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper function to format date string for input type="date"
  const formatDateForInput = (dateValue: string | Date | undefined): string => {
    if (!dateValue) return ''
    if (dateValue instanceof Date) {
      return formatDateLocal(dateValue)
    }
    if (typeof dateValue === 'string') {
      // Extract YYYY-MM-DD from string (handle various formats)
      const dateStr = dateValue.split('T')[0].split(' ')[0]
      // Validate format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr
      }
      // Try to parse and reformat
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        return formatDateLocal(parsed)
      }
    }
    return ''
  }

  const handleDateClick = (date: Date) => {
    if (!user) {
      alert('Silakan login untuk menambah acara')
      router.push('/login')
      return
    }
    const dateStr = formatDateLocal(date)
    setSelectedDate(dateStr)
    setFormData((prev) => ({ ...prev, event_date: dateStr }))
    setSelectedEvent(null)
    setShowForm(true)
  }

  const handleEventClick = (event: FamilyEvent) => {
    if (!user) {
      alert('Silakan login untuk mengelola acara')
      router.push('/login')
      return
    }
    setSelectedEvent(event)
    setFormData({
      title: event.title,
      description: event.description || '',
      event_date: formatDateForInput(event.event_date),
      event_time: event.event_time || '',
      location: event.location || '',
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = selectedEvent
        ? `/api/events/${selectedEvent.id}`
        : '/api/events'
      const method = selectedEvent ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchEvents()
        setShowForm(false)
        setSelectedEvent(null)
        setSelectedDate(null)
        setFormData({
          title: '',
          description: '',
          event_date: '',
          event_time: '',
          location: '',
        })
      }
    } catch (error) {
      console.error('Error saving event:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchEvents()
        setShowForm(false)
        setSelectedEvent(null)
      }
    } catch (error) {
      console.error('Error deleting event:', error)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = formatDateLocal(date)
    // Normalize event_date from database (might be Date object or string)
    const normalizedEvents = events.filter((e) => {
      let eventDateStr = e.event_date
      // If event_date is a Date object, convert it
      if (eventDateStr instanceof Date) {
        eventDateStr = formatDateLocal(eventDateStr)
      } else if (typeof eventDateStr === 'string') {
        // If it's a string, extract just the date part (YYYY-MM-DD)
        eventDateStr = eventDateStr.split('T')[0].split(' ')[0]
      }
      // Compare normalized dates
      return eventDateStr === dateStr
    })
    return normalizedEvents
  }

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(year, month + direction, 1))
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ]

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pt-16 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  📅 Acara Keluarga
                </h1>
                <p className="text-gray-600">
                  Kelola dan lihat acara keluarga yang akan datang
                </p>
              </div>
            </div>
          </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Calendar Header */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => navigateMonth(-1)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              ←
            </button>
            <h2 className="text-2xl font-bold text-gray-800">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              →
            </button>
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {/* Day Headers */}
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center font-semibold text-gray-700 py-2"
                >
                  {day}
                </div>
              ))}

              {/* Empty cells for days before month starts */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Calendar Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const date = new Date(year, month, day)
                const dateStr = formatDateLocal(date)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const dateOnly = new Date(date)
                dateOnly.setHours(0, 0, 0, 0)
                const isPast = dateOnly < today
                const dayEvents = getEventsForDate(date)
                const isToday = dateStr === formatDateLocal(new Date())

                return (
                  <div
                    key={day}
                    className={`aspect-square border-2 rounded-lg p-2 transition-colors ${
                      isPast
                        ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                        : isToday
                        ? 'border-primary-500 bg-primary-50 cursor-pointer hover:bg-primary-100'
                        : 'border-gray-200 cursor-pointer hover:bg-blue-50'
                    }`}
                    onClick={() => !isPast && handleDateClick(date)}
                  >
                    <div
                      className={`text-sm font-semibold mb-1 ${
                        isToday ? 'text-primary-700' : 'text-gray-700'
                      }`}
                    >
                      {day}
                    </div>
                    {dayEvents.length > 0 && (
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEventClick(event)
                            }}
                            className="text-xs bg-primary-500 text-white px-1 py-0.5 rounded truncate hover:bg-primary-600"
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{dayEvents.length - 2} lagi
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Event Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedEvent ? 'Edit Acara' : 'Tambah Acara'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowForm(false)
                      setSelectedEvent(null)
                      setSelectedDate(null)
                      setFormData({
                        title: '',
                        description: '',
                        event_date: '',
                        event_time: '',
                        location: '',
                      })
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Judul Acara *
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal *
                    </label>
                    <input
                      type="date"
                      name="event_date"
                      value={formData.event_date}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Waktu
                    </label>
                    <input
                      type="time"
                      name="event_time"
                      value={formData.event_time}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lokasi
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="Contoh: Rumah Keluarga"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deskripsi
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                    >
                      {selectedEvent ? 'Update' : 'Simpan'} Acara
                    </button>
                    {selectedEvent && (
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedEvent.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                      >
                        Hapus
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false)
                        setSelectedEvent(null)
                        setSelectedDate(null)
                        setFormData({
                          title: '',
                          description: '',
                          event_date: '',
                          event_time: '',
                          location: '',
                        })
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
      </main>
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/Navbar'

interface Documentation {
  id: number
  title: string
  description?: string
  file_type: 'photo' | 'video'
  file_url: string
  thumbnail_url?: string
  event_id?: number
  event_title?: string
  uploaded_by?: number
  uploaded_by_name?: string
  created_at: string
}

interface FamilyEvent {
  id: number
  title: string
  event_date: string
}

export default function DocumentationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [docs, setDocs] = useState<Documentation[]>([])
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedType, setSelectedType] = useState<'photo' | 'video'>('photo')
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_id: '',
    file: null as File | null,
  })
  const [uploading, setUploading] = useState(false)
  const canManage = Boolean(user)

  useEffect(() => {
    fetchDocumentation()
    fetchEvents()
  }, [filterType])

  const fetchDocumentation = async () => {
    try {
      setLoading(true)
      const url = filterType === 'all' 
        ? '/api/documentation'
        : `/api/documentation?type=${filterType}`
      const response = await fetch(url)
      const data = await response.json()
      setDocs(data)
    } catch (error) {
      console.error('Error fetching documentation:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events')
      const data = await response.json()
      setEvents(data)
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData({ ...formData, file })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.file) {
      alert('Please select a file')
      return
    }

    try {
      setUploading(true)
      const uploadData = new FormData()
      uploadData.append('title', formData.title)
      uploadData.append('description', formData.description)
      uploadData.append('file_type', selectedType)
      uploadData.append('file', formData.file)
      if (formData.event_id) {
        uploadData.append('event_id', formData.event_id)
      }

      const response = await fetch('/api/documentation', {
        method: 'POST',
        body: uploadData,
      })

      if (response.ok) {
        await fetchDocumentation()
        setShowUploadForm(false)
        setFormData({
          title: '',
          description: '',
          event_id: '',
          file: null,
        })
        setSelectedType('photo')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to upload')
      }
    } catch (error) {
      console.error('Error uploading:', error)
      alert('Network error')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this documentation?')) return

    try {
      const response = await fetch(`/api/documentation/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchDocumentation()
      } else {
        alert('Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Network error')
    }
  }

  const handleOpenUploadForm = () => {
    if (!user) {
      router.push('/login')
      return
    }
    setShowUploadForm(true)
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pt-16 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  📸 Dokumentasi Keluarga
                </h1>
                <p className="text-gray-600">
                  Galeri foto dan video acara keluarga
                </p>
              </div>
              {canManage && (
                <button
                  onClick={handleOpenUploadForm}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-lg"
                >
                  + Upload Dokumentasi
                </button>
              )}
            </div>

            {/* Filter */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterType('photo')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'photo'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📷 Foto
              </button>
              <button
                onClick={() => setFilterType('video')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'video'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🎥 Video
              </button>
            </div>
          </div>

          {/* Gallery */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-500">Memuat dokumentasi...</div>
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-lg">
              <div className="text-6xl mb-4">📸</div>
              <p className="text-xl text-gray-600">
                Belum ada dokumentasi
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {doc.file_type === 'photo' ? (
                    <img
                      src={doc.file_url}
                      alt={doc.title}
                      className="w-full h-64 object-cover"
                    />
                  ) : (
                    <video
                      src={doc.file_url}
                      className="w-full h-64 object-cover"
                      controls
                      poster={doc.thumbnail_url}
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 mb-2 line-clamp-2">
                      {doc.title}
                    </h3>
                    {doc.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {doc.description}
                      </p>
                    )}
                    {doc.event_title && (
                      <p className="text-xs text-primary-600 mb-2">
                        📅 {doc.event_title}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString('id-ID')}
                    </p>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="mt-3 w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium text-sm"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Form Modal */}
          {showUploadForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Upload Dokumentasi
                    </h2>
                    <button
                      onClick={() => {
                        setShowUploadForm(false)
                        setFormData({
                          title: '',
                          description: '',
                          event_id: '',
                          file: null,
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
                        Tipe File *
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="photo"
                            checked={selectedType === 'photo'}
                            onChange={(e) => setSelectedType(e.target.value as 'photo')}
                            className="mr-2"
                          />
                          📷 Foto
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="video"
                            checked={selectedType === 'video'}
                            onChange={(e) => setSelectedType(e.target.value as 'video')}
                            className="mr-2"
                          />
                          🎥 Video
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Judul *
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deskripsi
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Acara (Opsional)
                      </label>
                      <select
                        value={formData.event_id}
                        onChange={(e) =>
                          setFormData({ ...formData, event_id: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Pilih acara...</option>
                        {events.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.title} - {new Date(event.event_date).toLocaleDateString('id-ID')}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        File * (Max: {selectedType === 'photo' ? '10MB' : '100MB'})
                      </label>
                      <input
                        type="file"
                        accept={selectedType === 'photo' ? 'image/*' : 'video/*'}
                        onChange={handleFileChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="submit"
                        disabled={uploading}
                        className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        {uploading ? 'Mengupload...' : 'Upload'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowUploadForm(false)
                          setFormData({
                            title: '',
                            description: '',
                            event_id: '',
                            file: null,
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

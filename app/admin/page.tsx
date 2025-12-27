'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface PendingUser {
  id: number
  username: string
  name: string
  role: string
  status: string
  created_at: string
  member_id?: number
  member_name?: string
}

export default function AdminPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
        return
      }
      fetchPendingUsers()
    }
  }, [user, authLoading, router])

  const fetchPendingUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/pending-users')
      if (response.ok) {
        const data = await response.json()
        setPendingUsers(data)
      }
    } catch (error) {
      console.error('Error fetching pending users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: number, action: 'approve' | 'reject') => {
    try {
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, action }),
      })

      if (response.ok) {
        await fetchPendingUsers()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to process')
      }
    } catch (error) {
      console.error('Error processing approval:', error)
      alert('Network error')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1 pr-4">
              <h1 className="text-4xl font-bold text-gray-800 mb-2 break-words">
                👥 User Approvals{user?.family_name ? ` - ${user.family_name}` : ''}
              </h1>
              <p className="text-gray-600">
                Approve atau reject pendaftaran pengguna yang menunggu
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                ← Kembali
              </button>
            </div>
          </div>
        </div>
        </div>

        {/* Pending Users */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Pending Approvals
          </h2>

          {pendingUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Tidak ada pendaftaran yang menunggu approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((pendingUser) => (
                <div
                  key={pendingUser.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">
                        {pendingUser.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Username: <span className="font-medium">{pendingUser.username}</span>
                      </p>
                      {pendingUser.member_name && (
                        <p className="text-sm text-gray-600 mb-2">
                          Linked to: <span className="font-medium">{pendingUser.member_name}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Daftar pada: {new Date(pendingUser.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(pendingUser.id, 'approve')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprove(pendingUser.id, 'reject')}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

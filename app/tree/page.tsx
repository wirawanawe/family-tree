'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FamilyTree from '@/components/FamilyTree'
import MemberForm from '@/components/MemberForm'
import MemberList from '@/components/MemberList'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/Navbar'

interface FamilyMember {
  id: number
  member_code?: string
  name: string
  gender: 'male' | 'female'
  birth_date?: string
  death_date?: string
  father_id?: number
  mother_id?: number
  spouse_id?: number
  no_hp?: string
  alamat?: string
  email?: string
  photo_url?: string
  notes?: string
  child_order?: number | null
}

export default function TreePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [treeData, setTreeData] = useState<any>(null)
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree')
  const [loading, setLoading] = useState(true)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchMembers()
      fetchTree()
    }
  }, [user])

  // Auto-navigate member to their position in tree
  const canManage = Boolean(user)

  useEffect(() => {
    if (user && user.member_id && treeData) {
      const member = treeData.members?.find((m: any) => m.id === user.member_id)
      if (member) {
        const parentId = member.father_id || member.mother_id
        if (parentId) {
          // Navigation will be handled by FamilyTree component
        }
      }
    }
  }, [user, treeData])

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/members')
      if (response.status === 401) {
        router.push('/login')
        return
      }
      const data = await response.json()
      setMembers(data)
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTree = async () => {
    try {
      const response = await fetch('/api/tree')
      if (response.status === 401) {
        router.push('/login')
        return
      }
      const data = await response.json()
      setTreeData(data)
    } catch (error) {
      console.error('Error fetching tree:', error)
    }
  }

  const handleAddMember = async (memberData: Partial<FamilyMember>) => {
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      })

      if (response.ok) {
        await fetchMembers()
        await fetchTree()
        setShowForm(false)
        setSelectedMember(null)
      }
    } catch (error) {
      console.error('Error adding member:', error)
    }
  }

  const handleEdit = (member: FamilyMember) => {
    setSelectedMember(member)
    setShowForm(true)
  }

  const handleDeleteMember = async (id: number) => {
    if (!confirm('Are you sure you want to delete this member?')) return

    try {
      const response = await fetch(`/api/members/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchMembers()
        await fetchTree()
      }
    } catch (error) {
      console.error('Error deleting member:', error)
    }
  }

  const handleNewMember = () => {
    setSelectedMember(null)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setSelectedMember(null)
  }

  const handleFormSubmit = async (memberData: Partial<FamilyMember>) => {
    if (selectedMember) {
      try {
        const response = await fetch(`/api/members/${selectedMember.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(memberData),
        })

        if (response.ok) {
          await fetchMembers()
          await fetchTree()
          setShowForm(false)
          setSelectedMember(null)
        }
      } catch (error) {
        console.error('Error updating member:', error)
      }
    } else {
      await handleAddMember(memberData)
    }
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pt-16">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1 pr-4">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 break-words">
                  🌳 Pohon Keluarga{user?.family_name ? ` - ${user.family_name}` : ''}
                </h1>
                <p className="text-gray-600">
                  Visualisasikan dan kelola hubungan keluarga Anda
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <a
                  href="/events"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-md"
                >
                  📅 Acara Keluarga
                </a>
                {canManage && (
                  <button
                    onClick={handleNewMember}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-md"
                  >
                    + Tambah Anggota Keluarga
                  </button>
                )}
              </div>
            </div>

            {/* View Toggle */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setViewMode('tree')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'tree'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Tree View
              </button>
              {canManage && (
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  List View
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl text-gray-500">Loading...</div>
            </div>
          ) : (
            <>
              {viewMode === 'tree' ? (
                <FamilyTree
                  treeData={treeData}
                  onEdit={canManage ? handleEdit : undefined}
                  onDelete={canManage ? handleDeleteMember : undefined}
                  memberId={user?.member_id}
                />
              ) : (
                <MemberList
                  members={members}
                  onEdit={canManage ? handleEdit : undefined}
                  onDelete={canManage ? handleDeleteMember : undefined}
                />
              )}
            </>
          )}

          {/* Member Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                      {selectedMember ? 'Edit Member' : 'Tambah Anggota Keluarga'}
                    </h2>
                    <button
                      onClick={handleFormClose}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ×
                    </button>
                  </div>
                  <MemberForm
                    member={selectedMember || undefined}
                    members={members}
                    onSubmit={handleFormSubmit}
                    onCancel={handleFormClose}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}

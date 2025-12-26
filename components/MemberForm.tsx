'use client'

import { useState, useEffect } from 'react'

interface FamilyMember {
  id?: number
  member_code?: string
  name: string
  gender: 'male' | 'female'
  birth_date?: string
  death_date?: string
  father_id?: number
  mother_id?: number
  spouse_id?: number
  spouse_code?: string
  no_hp?: string
  alamat?: string
  email?: string
  child_order?: number | null
  photo_url?: string
  notes?: string
}

interface MemberFormProps {
  member?: FamilyMember | null
  members: FamilyMember[]
  onSubmit: (data: Partial<FamilyMember>) => void
  onCancel: () => void
}

export default function MemberForm({
  member,
  members,
  onSubmit,
  onCancel,
}: MemberFormProps) {
  const [formData, setFormData] = useState<Partial<FamilyMember>>({
    name: '',
    gender: 'male',
    birth_date: '',
    death_date: '',
    father_id: undefined,
    mother_id: undefined,
    spouse_id: undefined,
    spouse_code: '',
    child_order: undefined,
    no_hp: '',
    alamat: '',
    email: '',
    photo_url: '',
    notes: '',
  })
  const [spouseCodeValid, setSpouseCodeValid] = useState<boolean | null>(null)
  const [spouseCodeInfo, setSpouseCodeInfo] = useState<string>('')
  const [currentSpouse, setCurrentSpouse] = useState<{ id: number; name: string; member_code?: string; fromOtherFamily: boolean } | null>(null)

  useEffect(() => {
    if (member) {
      // Format tanggal untuk input type="date" (YYYY-MM-DD)
      const formatDateForInput = (dateStr: string | undefined | null): string => {
        if (!dateStr) return ''
        // Jika sudah format YYYY-MM-DD, return langsung
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr
        // Jika format lain, convert ke YYYY-MM-DD
        try {
          const date = new Date(dateStr)
          if (isNaN(date.getTime())) return ''
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        } catch {
          return ''
        }
      }

      setFormData({
        name: member.name || '',
        gender: member.gender || 'male',
        birth_date: formatDateForInput(member.birth_date),
        death_date: formatDateForInput(member.death_date),
        father_id: member.father_id,
        mother_id: member.mother_id,
        spouse_id: member.spouse_id,
        spouse_code: member.spouse_code || '',
        child_order: member.child_order,
        no_hp: member.no_hp || '',
        alamat: member.alamat || '',
        email: member.email || '',
        photo_url: member.photo_url || '',
        notes: member.notes || '',
      })
      setSpouseCodeValid(null)
      setSpouseCodeInfo('')
      
      // Fetch current spouse information if spouse_id exists
      if (member.spouse_id) {
        fetchSpouseInfo(member.spouse_id)
      } else {
        setCurrentSpouse(null)
      }
    } else {
      // Reset form jika tidak ada member
      setFormData({
        name: '',
        gender: 'male',
        birth_date: '',
        death_date: '',
        father_id: undefined,
        mother_id: undefined,
        spouse_id: undefined,
        spouse_code: '',
        child_order: undefined,
        no_hp: '',
        alamat: '',
        email: '',
        photo_url: '',
        notes: '',
      })
      setSpouseCodeValid(null)
      setSpouseCodeInfo('')
      setCurrentSpouse(null)
    }
  }, [member, members])

  // Function to fetch spouse information
  const fetchSpouseInfo = async (spouseId: number) => {
    try {
      // First check if spouse is in current family
      const spouseInFamily = members.find(m => m.id === spouseId)
      if (spouseInFamily) {
        setCurrentSpouse({
          id: spouseInFamily.id,
          name: spouseInFamily.name,
          member_code: spouseInFamily.member_code,
          fromOtherFamily: false
        })
      } else {
        // Spouse is from other family, try to fetch basic info via API
        try {
          const response = await fetch(`/api/members/by-id/${spouseId}`)
          if (response.ok) {
            const spouseData = await response.json()
            setCurrentSpouse({
              id: spouseId,
              name: spouseData.name || 'Pasangan dari keluarga lain',
              member_code: spouseData.member_code,
              fromOtherFamily: true
            })
          } else {
            setCurrentSpouse({
              id: spouseId,
              name: 'Pasangan dari keluarga lain',
              fromOtherFamily: true
            })
          }
        } catch (error) {
          // If API fails, show generic info
          setCurrentSpouse({
            id: spouseId,
            name: 'Pasangan dari keluarga lain',
            fromOtherFamily: true
          })
        }
      }
    } catch (error) {
      console.error('Error fetching spouse info:', error)
      setCurrentSpouse(null)
    }
  }

  // Function to remove spouse connection
  const handleRemoveSpouse = () => {
    setFormData((prev) => ({
      ...prev,
      spouse_id: undefined,
      spouse_code: ''
    }))
    setCurrentSpouse(null)
    setSpouseCodeValid(null)
    setSpouseCodeInfo('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleChange = async (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target
    
    // Handle spouse_code validation
    if (name === 'spouse_code') {
      setFormData((prev) => ({ ...prev, [name]: value, spouse_id: undefined }))
      if (value && value.trim()) {
        try {
          const response = await fetch(`/api/members/by-code?code=${encodeURIComponent(value.trim())}`)
          if (response.ok) {
            const spouseData = await response.json()
            setSpouseCodeValid(true)
            setSpouseCodeInfo(`${spouseData.name} (${spouseData.gender === 'male' ? 'Laki-laki' : 'Perempuan'})`)
          } else {
            setSpouseCodeValid(false)
            setSpouseCodeInfo('Kode tidak ditemukan')
          }
        } catch (error) {
          setSpouseCodeValid(false)
          setSpouseCodeInfo('Error validasi kode')
        }
      } else {
        setSpouseCodeValid(null)
        setSpouseCodeInfo('')
      }
      return
    }
    
    // If spouse_id is selected, clear spouse_code and update current spouse
    if (name === 'spouse_id') {
      const numericFields = ['father_id', 'mother_id', 'spouse_id', 'child_order']
      const parsedValue = numericFields.includes(name) && value !== '' ? Number(value) : value === '' ? undefined : value
      
      setFormData((prev) => ({ ...prev, [name]: parsedValue, spouse_code: '' }))
      setSpouseCodeValid(null)
      setSpouseCodeInfo('')
      
      if (value && parsedValue) {
        fetchSpouseInfo(parsedValue as number)
      } else {
        setCurrentSpouse(null)
      }
      return
    }
    
    const numericFields = ['father_id', 'mother_id', 'spouse_id', 'child_order']
    const parsedValue =
      numericFields.includes(name) && value !== ''
        ? Number(value)
        : value === ''
        ? undefined
        : value

    setFormData((prev) => ({
      ...prev,
      [name]: parsedValue,
    }))
  }

  // Filter members for dropdowns
  const memberList = Array.isArray(members) ? members : []
  const availableFathers = memberList.filter(
    (m) => m.gender === 'male' && m.id !== member?.id
  )
  const availableMothers = memberList.filter(
    (m) => m.gender === 'female' && m.id !== member?.id
  )
  const availableSpouses = memberList.filter(
    (m) => m.gender !== formData.gender && m.id !== member?.id
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gender *
        </label>
        <select
          name="gender"
          value={formData.gender}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Birth Date
          </label>
          <input
            type="date"
            name="birth_date"
            value={formData.birth_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Death Date
          </label>
          <input
            type="date"
            name="death_date"
            value={formData.death_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Father
          </label>
          <select
            name="father_id"
            value={formData.father_id || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">None</option>
            {availableFathers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mother
          </label>
          <select
            name="mother_id"
            value={formData.mother_id || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">None</option>
            {availableMothers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Pasangan (Spouse)
        </label>
        
        {/* Display current spouse if exists */}
        {currentSpouse && !formData.spouse_code && (formData.spouse_id === currentSpouse.id || !formData.spouse_id) && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Pasangan Saat Ini: {currentSpouse.name}
                </p>
                {currentSpouse.member_code && (
                  <p className="text-xs text-gray-600 mt-1">
                    Kode: {currentSpouse.member_code}
                  </p>
                )}
                {currentSpouse.fromOtherFamily && (
                  <p className="text-xs text-blue-600 mt-1">
                    ⚠️ Pasangan dari keluarga lain
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleRemoveSpouse}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
              >
                Hapus Hubungan
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Klik "Hapus Hubungan" jika pasangan sudah bercerai/berpisah. Hubungan akan diputus dari kedua sisi.
            </p>
          </div>
        )}

        <select
          name="spouse_id"
          value={formData.spouse_id || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-2"
        >
          <option value="">Pilih dari keluarga ini</option>
          {availableSpouses.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <div className="text-sm text-gray-500 mb-2 text-center">atau</div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kode Pasangan (dari keluarga lain)
          </label>
          <input
            type="text"
            name="spouse_code"
            value={formData.spouse_code || ''}
            onChange={handleChange}
            placeholder="Masukkan kode member pasangan (contoh: MEM123456)"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              spouseCodeValid === true
                ? 'border-green-500 bg-green-50'
                : spouseCodeValid === false
                ? 'border-red-500 bg-red-50'
                : 'border-gray-300'
            }`}
          />
          {spouseCodeInfo && (
            <p
              className={`text-xs mt-1 ${
                spouseCodeValid ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {spouseCodeInfo}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Gunakan ini jika pasangan berasal dari keluarga lain. Minta kode member mereka di halaman detail member mereka.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Child Order (anak ke-berapa)
        </label>
        <input
          type="number"
          name="child_order"
          min={1}
          value={formData.child_order ?? ''}
          onChange={handleChange}
          placeholder="Contoh: 1"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            No. HP
          </label>
          <input
            type="text"
            name="no_hp"
            value={formData.no_hp}
            onChange={handleChange}
            placeholder="08xxxxxxxxxx"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="email@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alamat
          </label>
          <textarea
            name="alamat"
            value={formData.alamat}
            onChange={handleChange}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Photo URL
        </label>
        <input
          type="url"
          name="photo_url"
          value={formData.photo_url}
          onChange={handleChange}
          placeholder="https://example.com/photo.jpg"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          name="notes"
          value={formData.notes}
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
          {member ? 'Update' : 'Add'} Member
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

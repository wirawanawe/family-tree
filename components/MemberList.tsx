'use client'

interface FamilyMember {
  id: number
  name: string
  gender: 'male' | 'female'
  birth_date?: string
  death_date?: string
  father_id?: number
  mother_id?: number
  spouse_id?: number
  photo_url?: string
  notes?: string
  child_order?: number | null
}

interface MemberListProps {
  members: FamilyMember[]
  onEdit?: (member: FamilyMember) => void
  onDelete?: (id: number) => void
}

export default function MemberList({
  members,
  onEdit,
  onDelete,
}: MemberListProps) {
  const getMemberName = (id?: number) => {
    if (!id) return 'N/A'
    const member = members.find((m) => m.id === id)
    return member?.name || 'Unknown'
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">
          No family members yet. Add someone to get started!
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-700">
              Name
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">
              Gender
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">
              Birth Date
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">
              Death Date
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">
              Father
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">
              Mother
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">
              Spouse
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">
              Child #
            </th>
            {(onEdit || onDelete) && (
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr
              key={member.id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {member.gender === 'male' ? '👨' : '👩'}
                  </span>
                  <span className="font-medium text-gray-800">
                    {member.name}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    member.gender === 'male'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-pink-100 text-pink-700'
                  }`}
                >
                  {member.gender}
                </span>
              </td>
              <td className="py-3 px-4 text-gray-600">
                {member.birth_date
                  ? new Date(member.birth_date).toLocaleDateString()
                  : 'N/A'}
              </td>
              <td className="py-3 px-4 text-gray-600">
                {member.death_date
                  ? new Date(member.death_date).toLocaleDateString()
                  : 'N/A'}
              </td>
              <td className="py-3 px-4 text-gray-600">
                {getMemberName(member.father_id)}
              </td>
              <td className="py-3 px-4 text-gray-600">
                {getMemberName(member.mother_id)}
              </td>
              <td className="py-3 px-4 text-gray-600">
                {getMemberName(member.spouse_id)}
              </td>
              <td className="py-3 px-4 text-gray-800 font-semibold">
                {member.child_order ? `#${member.child_order}` : '—'}
              </td>
              {(onEdit || onDelete) && (
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(member)}
                        className="px-3 py-1 bg-primary-500 text-white text-sm rounded hover:bg-primary-600 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(member.id)}
                        className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

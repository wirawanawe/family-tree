'use client'

import { useState, useEffect, useRef } from 'react'

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
  children?: FamilyMember[]
  siblings?: FamilyMember[]
}

interface FamilyTreeProps {
  treeData: {
    roots: FamilyMember[]
    members: FamilyMember[]
  } | null
  onEdit?: (member: FamilyMember) => void
  onDelete?: (id: number) => void
  memberId?: number // For auto-navigation to member position
}

type ViewType = 'roots' | 'children' | 'childDetail'

interface ViewState {
  type: ViewType
  parentId?: number
  childId?: number
}

export default function FamilyTree({ treeData, onEdit, onDelete, memberId }: FamilyTreeProps) {
  const [zoom, setZoom] = useState(1)
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'roots' })
  const [navigationHistory, setNavigationHistory] = useState<ViewState[]>([])
  const [detailMember, setDetailMember] = useState<FamilyMember | null>(null)
  const [prevTreeDataHash, setPrevTreeDataHash] = useState<string>('')
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true)

  // Reset view hanya ketika struktur tree berubah (parent/child relationship), bukan saat update data
  useEffect(() => {
    if (!treeData || !treeData.roots || !treeData.members) return
    
    // Hash tree data untuk detect perubahan struktur (bukan hanya update data)
    const currentHash = JSON.stringify({
      roots: treeData.roots.map(r => r.id),
      members: treeData.members.map(m => ({ id: m.id, father_id: m.father_id, mother_id: m.mother_id }))
    })
    
    // Hanya reset jika struktur tree berubah (parent/child relationship berubah)
    // Bukan saat hanya update data member (name, email, dll)
    if (prevTreeDataHash && currentHash !== prevTreeDataHash) {
      // Cek apakah perubahan adalah perubahan struktur (parent/child) atau hanya data
      const prevStructure = JSON.parse(prevTreeDataHash)
      const currStructure = JSON.parse(currentHash)
      
      // Bandingkan struktur parent/child
      const structureChanged = 
        JSON.stringify(prevStructure.roots) !== JSON.stringify(currStructure.roots) ||
        JSON.stringify(prevStructure.members) !== JSON.stringify(currStructure.members)
      
      if (structureChanged) {
        setCurrentView({ type: 'roots' })
        setNavigationHistory([])
      }
    }
    
    if (!prevTreeDataHash) {
      setPrevTreeDataHash(currentHash)
    } else if (currentHash !== prevTreeDataHash) {
      setPrevTreeDataHash(currentHash)
    }
  }, [treeData, prevTreeDataHash])

  const memberMap = new Map<number, FamilyMember>(
    treeData?.members?.map((m) => [m.id, m]) ?? []
  )

  // Auto-navigate member to their position
  useEffect(() => {
    if (memberId && treeData && !hasAutoNavigated) {
      const member = memberMap.get(memberId)
      if (member) {
        // Find parent to navigate to children view
        const parentId = member.father_id || member.mother_id
        if (parentId) {
          // Navigate to children view showing this member
          setCurrentView({ type: 'children', parentId })
          setNavigationHistory([{ type: 'roots' }])
        }
        // If member is root, stay at roots view
        setHasAutoNavigated(true)
      }
    }
  }, [memberId, treeData, hasAutoNavigated, memberMap])

  // Auto-adjust zoom to fit content
  useEffect(() => {
    if (!autoZoomEnabled) return

    const adjustZoom = () => {
      // Wait for DOM to update
      const timeoutId = setTimeout(() => {
        const content = contentRef.current
        const container = containerRef.current
        if (!content || !container) return

        // Temporarily remove scale to measure natural width
        const prevTransform = content.style.transform
        content.style.transform = 'none'

        const naturalWidth = content.scrollWidth || content.offsetWidth
        const containerWidth = container.clientWidth - 32 // allow small padding

        // Restore transform
        content.style.transform = prevTransform

        if (naturalWidth > 0 && containerWidth > 0) {
          // If content already fits, reset to 100%
          if (naturalWidth <= containerWidth * 0.95) {
            setZoom(1)
            return
          }

          // Calculate optimal zoom to fit (with 5% margin)
          let optimalZoom = (containerWidth * 0.95) / naturalWidth
          // For auto-fit, jangan terlalu kecil supaya tetap terlihat (min 30%)
          optimalZoom = Math.min(1, Math.max(0.3, optimalZoom))
          setZoom(optimalZoom)
        }
      }, 150)

      return () => clearTimeout(timeoutId)
    }

    const cleanup = adjustZoom()

    // Also adjust on window resize
    const handleResize = () => {
      if (autoZoomEnabled) adjustZoom()
    }

    window.addEventListener('resize', handleResize)
    return () => {
      if (cleanup) cleanup()
      window.removeEventListener('resize', handleResize)
    }
  }, [currentView, treeData, autoZoomEnabled])

  if (!treeData || !treeData.roots || treeData.roots.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No family members yet. Add someone to get started!</p>
      </div>
    )
  }

  const navigateTo = (newView: ViewState) => {
    // Aktifkan kembali auto-fit agar tampilan rapi saat pindah view
    setAutoZoomEnabled(true)
    setNavigationHistory((prev) => [...prev, currentView])
    setCurrentView(newView)
  }

  const navigateBack = () => {
    if (navigationHistory.length > 0) {
      // Aktifkan kembali auto-fit agar tampilan rapi saat kembali
      setAutoZoomEnabled(true)
      const previousView = navigationHistory[navigationHistory.length - 1]
      setNavigationHistory((prev) => prev.slice(0, -1))
      setCurrentView(previousView)
    }
  }

  const getSpouse = (member: FamilyMember) => {
    if (member.spouse_id && memberMap.has(member.spouse_id)) {
      return memberMap.get(member.spouse_id)
    }
    for (const candidate of Array.from(memberMap.values())) {
      if (candidate.spouse_id === member.id) return candidate
    }
    return undefined
  }

  const getFatherName = (member: FamilyMember) => {
    if (member.father_id && memberMap.has(member.father_id)) {
      return memberMap.get(member.father_id)?.name ?? 'Fullan'
    }
    return 'Fullan'
  }

  const MemberCard = ({ 
    member, 
    onClick, 
    showSpouse = false 
  }: { 
    member: FamilyMember
    onClick?: () => void
    showSpouse?: boolean
  }) => {
    const spouse = showSpouse ? getSpouse(member) : undefined
    
    return (
      <div className="flex items-start gap-16 md:gap-20 mb-4 w-full justify-center flex-wrap">
        <div
          className={`relative bg-white rounded-2xl shadow-[0_12px_30px_-12px_rgba(0,0,0,0.35)] p-4 pb-5 w-[240px] flex-shrink-0 border ${
            member.gender === 'male' ? 'border-blue-200' : 'border-pink-200'
          } hover:shadow-[0_14px_34px_-12px_rgba(0,0,0,0.4)] transition-shadow cursor-pointer`}
          onClick={onClick}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            {member.child_order ? (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-700 shadow">
                Child #{member.child_order}
              </span>
            ) : (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 shadow">
                Member
              </span>
            )}
          </div>

          <div
            className={`w-16 h-16 rounded-full mx-auto mt-4 mb-3 flex items-center justify-center text-2xl ${
              member.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
            }`}
          >
            {member.gender === 'male' ? '👨' : '👩'}
          </div>

          <h3 className="text-center font-semibold text-gray-900 mb-1 text-lg">{member.name}</h3>
          {/* Nama dengan Bin/Binti dan nama ayah */}
          <div className="text-center text-sm text-gray-700 mb-2">
            <div className="text-gray-500">{member.gender === 'male' ? 'Bin' : 'Binti'}</div>
            <div className="font-medium">{getFatherName(member)}</div>
          </div>

          <div className="flex gap-2 justify-center mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDetailMember(member)
              }}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
            >
              Detail
            </button>
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(member)
                }}
                className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(member.id)
                }}
                className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-sm"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {spouse && (
          <>
            <div className="h-0.5 w-16 bg-primary-400 rounded self-center flex-shrink-0" />
            <div
              className={`relative bg-white rounded-2xl shadow-[0_12px_30px_-12px_rgba(0,0,0,0.35)] p-4 pb-5 w-[240px] flex-shrink-0 border ${
                spouse.gender === 'male' ? 'border-blue-200' : 'border-pink-200'
              } hover:shadow-[0_14px_34px_-12px_rgba(0,0,0,0.4)] transition-shadow`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 shadow">
                  Member
                </span>
              </div>

              <div
                className={`w-16 h-16 rounded-full mx-auto mt-4 mb-3 flex items-center justify-center text-2xl ${
                  spouse.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                }`}
              >
                {spouse.gender === 'male' ? '👨' : '👩'}
              </div>

              <h3 className="text-center font-semibold text-gray-900 mb-1 text-lg">{spouse.name}</h3>
              <div className="text-center text-sm text-gray-700 mb-2">
                <div className="text-gray-500">{spouse.gender === 'male' ? 'Bin' : 'Binti'}</div>
                <div className="font-medium">{getFatherName(spouse)}</div>
              </div>

              <div className="flex gap-2 justify-center mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDetailMember(spouse)
                  }}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
                >
                  Detail
                </button>
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(spouse)
                    }}
                    className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm"
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(spouse.id)
                    }}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderRoots = () => {
    // Pasangan ditampilkan bersama (satu tombol), dengan garis penghubung
    const renderedPairs = new Set<string>()

    // Ambil root dengan posisi paling tinggi (paling banyak keturunan/descendants)
    const countDescendants = (member: FamilyMember): number => {
      if (!member.children || member.children.length === 0) return 0
      return member.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
    }
    const highestRoot = treeData!.roots.reduce((best, current) => {
      const bestScore = countDescendants(best)
      const currentScore = countDescendants(current)
      if (currentScore > bestScore) return current
      return best
    }, treeData!.roots[0])

    const rootsToRender = highestRoot ? [highestRoot] : []

    return (
      <div className="flex flex-wrap justify-center gap-10">
        {rootsToRender.map((root) => {
          const spouse = getSpouse(root)
          const pairKey = spouse ? [root.id, spouse.id].sort((a, b) => a - b).join('-') : `${root.id}`
          if (renderedPairs.has(pairKey)) return null
          renderedPairs.add(pairKey)

          const mergedChildrenMap = new Map<number, FamilyMember>()
          ;(root.children || []).forEach((c) => mergedChildrenMap.set(c.id, c))
          ;(spouse?.children || []).forEach((c) => mergedChildrenMap.set(c.id, c))
          const hasChildren = mergedChildrenMap.size > 0

          return (
            <div key={pairKey} className="flex flex-col items-center">
              <div className="flex items-start gap-8 md:gap-10">
                <MemberCard member={root} showSpouse={false} onClick={() => hasChildren && navigateTo({ type: 'children', parentId: root.id })} />
                {spouse && (
                  <>
                    <div className="h-0.5 w-10 bg-primary-400 rounded self-center" />
                    <MemberCard member={spouse} showSpouse={false} onClick={() => hasChildren && navigateTo({ type: 'children', parentId: root.id })} />
                  </>
                )}
              </div>
              {hasChildren && (
                <button
                  onClick={() => navigateTo({ type: 'children', parentId: root.id })}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md text-sm font-medium"
                >
                  Lihat Anak ↓
                </button>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderChildren = () => {
    if (!currentView.parentId) return null

    const parent = memberMap.get(currentView.parentId)
    if (!parent) return null

    const spouse = getSpouse(parent)
    const mergedChildrenMap = new Map<number, FamilyMember>()
    ;(parent.children || []).forEach((c) => mergedChildrenMap.set(c.id, c))
    ;(spouse?.children || []).forEach((c) => mergedChildrenMap.set(c.id, c))
    const children = Array.from(mergedChildrenMap.values())

    return (
      <div className="flex flex-col items-center w-full">
        {/* Parent dengan pasangan */}
        <div className="mb-6">
          <MemberCard member={parent} showSpouse={true} />
        </div>

        {/* Children tanpa pasangan - layout memanjang horizontal */}
        {children.length > 0 && (
          <div className="flex flex-col items-center mt-6 w-full">
            <div className="w-px h-10 bg-gray-300 mb-6" />
            {/* Layout memanjang horizontal tanpa scroll */}
            <div className="flex flex-row items-start justify-center gap-10 w-full pb-4" style={{ flexWrap: 'nowrap' }}>
              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center flex-shrink-0">
                  <div className="w-px h-10 bg-gray-300 mb-6" />
                  <MemberCard 
                    member={child}
                    onClick={() => {
                      const childSpouse = getSpouse(child)
                      if (childSpouse) {
                        navigateTo({ type: 'childDetail', parentId: currentView.parentId, childId: child.id })
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderChildDetail = () => {
    if (!currentView.childId || !currentView.parentId) return null

    const child = memberMap.get(currentView.childId)
    if (!child) return null

    const childSpouse = getSpouse(child)
    const mergedChildrenMap = new Map<number, FamilyMember>()
    ;(child.children || []).forEach((c) => mergedChildrenMap.set(c.id, c))
    ;(childSpouse?.children || []).forEach((c) => mergedChildrenMap.set(c.id, c))
    const childHasChildren = mergedChildrenMap.size > 0

    return (
      <div className="flex flex-col items-center w-full">
        {/* Anak yang diklik + pasangan (jika ada) */}
        <div className="flex items-start gap-12 md:gap-14 justify-center">
          <MemberCard member={child} showSpouse={!!childSpouse} />
        </div>

        {/* Tombol lihat anak jika anak ini punya anak */}
        {childHasChildren && (
          <button
            onClick={() => navigateTo({ type: 'children', parentId: child.id })}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md text-sm font-medium"
          >
            Lihat Anak ↓
          </button>
        )}
      </div>
    )
  }

  const getBreadcrumbPath = () => {
    const path: Array<{ name: string; view: ViewState }> = []
    
    // Root selalu ada
    if (!treeData?.roots || treeData.roots.length === 0) return path
    
    const highestRoot = treeData.roots.reduce((best, current) => {
      const countDescendants = (member: FamilyMember): number => {
        if (!member.children || member.children.length === 0) return 0
        return member.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
      }
      const bestScore = countDescendants(best)
      const currentScore = countDescendants(current)
      return currentScore > bestScore ? current : best
    }, treeData.roots[0])
    
    if (highestRoot) {
      const rootSpouse = getSpouse(highestRoot)
      const rootName = rootSpouse 
        ? `${highestRoot.name} & ${rootSpouse.name}`
        : highestRoot.name
      path.push({ name: rootName, view: { type: 'roots' } })
    }
    
    // Jika di children view, tambahkan parent
    if (currentView.type === 'children' && currentView.parentId) {
      const parent = memberMap.get(currentView.parentId)
      if (parent) {
        const parentSpouse = getSpouse(parent)
        const parentName = parentSpouse 
          ? `${parent.name} & ${parentSpouse.name}`
          : parent.name
        path.push({ name: parentName, view: { type: 'children', parentId: currentView.parentId } })
      }
    }
    
    // Jika di childDetail view, tambahkan parent dan child
    if (currentView.type === 'childDetail' && currentView.parentId) {
      const parent = memberMap.get(currentView.parentId)
      if (parent) {
        const parentSpouse = getSpouse(parent)
        const parentName = parentSpouse 
          ? `${parent.name} & ${parentSpouse.name}`
          : parent.name
        path.push({ name: parentName, view: { type: 'children', parentId: currentView.parentId } })
      }
      
      if (currentView.childId) {
        const child = memberMap.get(currentView.childId)
        if (child) {
          const childSpouse = getSpouse(child)
          const childName = childSpouse 
            ? `${child.name} & ${childSpouse.name}`
            : child.name
          path.push({ name: childName, view: { type: 'childDetail', parentId: currentView.parentId, childId: currentView.childId } })
        }
      }
    }
    
    return path
  }

  const navigateToBreadcrumb = (view: ViewState, index: number) => {
    // Navigate ke view yang dipilih
    // Jika klik root, reset semua
    if (view.type === 'roots') {
      setCurrentView({ type: 'roots' })
      setNavigationHistory([])
    } else if (view.type === 'children' && view.parentId) {
      // Navigate ke children view
      setCurrentView({ type: 'children', parentId: view.parentId })
      setNavigationHistory([{ type: 'roots' }])
    } else if (view.type === 'childDetail' && view.parentId && view.childId) {
      // Navigate ke childDetail view
      setCurrentView({ type: 'childDetail', parentId: view.parentId, childId: view.childId })
      setNavigationHistory([{ type: 'roots' }, { type: 'children', parentId: view.parentId }])
    }
  }

  const renderContent = () => {
    switch (currentView.type) {
      case 'roots':
        return renderRoots()
      case 'children':
        return renderChildren()
      case 'childDetail':
        return renderChildDetail()
      default:
        return renderRoots()
    }
  }

  const breadcrumbPath = getBreadcrumbPath()

  return (
    <div className="py-4">
      {/* Breadcrumb Navigation */}
      {breadcrumbPath.length > 1 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {breadcrumbPath.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-gray-400">/</span>}
              <button
                onClick={() => navigateToBreadcrumb(item.view, index)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  index === breadcrumbPath.length - 1
                    ? 'bg-primary-100 text-primary-700 cursor-default'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={index === breadcrumbPath.length - 1}
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Zoom controls */}
      <div className="flex justify-between items-center mb-4">
        {(currentView.type !== 'roots' || navigationHistory.length > 0) && (
          <button
            onClick={navigateBack}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium shadow-sm flex items-center gap-2"
          >
            ← Back
          </button>
        )}
        <div className="flex gap-2 ml-auto items-center">
          <button
            onClick={() => {
              setAutoZoomEnabled(false)
              setZoom((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))
            }}
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm"
            title="Zoom Out"
          >
            -
          </button>
          <div className="text-black px-3 py-1 rounded bg-white shadow text-sm font-semibold min-w-[60px] text-center">
            {(zoom * 100).toFixed(0)}%
          </div>
          <button
            onClick={() => {
              setAutoZoomEnabled(false)
              setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))
            }}
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => {
              setAutoZoomEnabled(true)
              // Trigger auto-fit immediately
              setTimeout(() => {
                const content = contentRef.current
                const container = containerRef.current
                if (content && container) {
                  const prevTransform = content.style.transform
                  content.style.transform = 'none'

                  const naturalWidth = content.scrollWidth || content.offsetWidth
                  const containerWidth = container.clientWidth - 32

                  content.style.transform = prevTransform

                  if (naturalWidth > 0 && containerWidth > 0) {
                    if (naturalWidth <= containerWidth * 0.95) {
                      setZoom(1)
                    } else {
                      const optimalZoom = Math.min(1, Math.max(0.3, (containerWidth * 0.95) / naturalWidth))
                      setZoom(optimalZoom)
                    }
                  }
                }
              }, 150)
            }}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              autoZoomEnabled
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Auto Fit - Sesuaikan zoom secara otomatis"
          >
            🔍 Auto
          </button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-inner p-6 flex justify-center overflow-x-auto"
      >
        <div
          ref={contentRef}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            minWidth: '600px',
            width: 'max-content',
          }}
        >
          {renderContent()}
        </div>
      </div>

      {/* Modal Detail */}
      {detailMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Detail Member</h2>
                <button
                  onClick={() => setDetailMember(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-center">
                  <div
                    className={`w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-4xl ${
                      detailMember.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                    }`}
                  >
                    {detailMember.gender === 'male' ? '👨' : '👩'}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">{detailMember.name}</h3>
                  <p className="text-sm text-gray-500">
                    {detailMember.gender === 'male' ? 'Laki-laki' : 'Perempuan'}
                  </p>
                  {detailMember.member_code && (
                    <div className="mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-mono inline-block">
                      📋 Kode: {detailMember.member_code}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-3">
                  {detailMember.member_code && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Kode Member:</span>
                      <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-gray-900 font-mono text-sm">{detailMember.member_code}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Bagikan kode ini untuk menghubungkan dengan keluarga lain
                        </p>
                      </div>
                    </div>
                  )}
                  {detailMember.birth_date && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Tanggal Lahir:</span>
                      <p className="text-gray-900">{new Date(detailMember.birth_date).toLocaleDateString('id-ID')}</p>
                    </div>
                  )}
                  {detailMember.death_date && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Tanggal Meninggal:</span>
                      <p className="text-gray-900">{new Date(detailMember.death_date).toLocaleDateString('id-ID')}</p>
                    </div>
                  )}
                  {detailMember.no_hp && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">No. HP:</span>
                      <p className="text-gray-900">{detailMember.no_hp}</p>
                    </div>
                  )}
                  {detailMember.email && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Email:</span>
                      <p className="text-gray-900">{detailMember.email}</p>
                    </div>
                  )}
                  {detailMember.alamat && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Alamat:</span>
                      <p className="text-gray-900 whitespace-pre-line">{detailMember.alamat}</p>
                    </div>
                  )}
                  {detailMember.notes && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Catatan:</span>
                      <p className="text-gray-900 whitespace-pre-line">{detailMember.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  {onEdit && (
                    <button
                      onClick={() => {
                        setDetailMember(null)
                        onEdit(detailMember)
                      }}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => setDetailMember(null)}
                    className={`${onEdit ? 'flex-1' : 'w-full'} px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium`}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

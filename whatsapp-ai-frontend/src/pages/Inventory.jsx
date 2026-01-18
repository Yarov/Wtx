import { useState, useEffect, useRef } from 'react'
import { 
  Package, Plus, Pencil, Trash2, X, CheckCircle, Upload, FileText, 
  Loader2, Sparkles, AlertCircle, Search, ArrowUpDown, Eye, Wand2,
  FileType, Table, List
} from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { Input } from '../components/Input'
import { inventoryApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ producto: '', stock: '', precio: '', descripcion: '', categoria: '' })
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('list')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('producto')
  const [sortOrder, setSortOrder] = useState('asc')
  const fileInputRef = useRef(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [productToDelete, setProductToDelete] = useState(null)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const response = await inventoryApi.getProducts()
      if (response.data.length > 0) {
        setProducts(response.data)
      }
    } catch (error) {
      console.log('Using default products')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newProduct = {
      id: editingId || Date.now(),
      producto: form.producto,
      stock: parseInt(form.stock),
      precio: parseFloat(form.precio),
      descripcion: form.descripcion || '',
      categoria: form.categoria || 'General',
    }

    if (editingId) {
      setProducts(products.map(p => p.id === editingId ? newProduct : p))
    } else {
      setProducts([...products, newProduct])
    }

    try {
      if (editingId) {
        await inventoryApi.updateProduct(editingId, newProduct)
      } else {
        await inventoryApi.createProduct(newProduct)
      }
    } catch (error) {
      console.log('Saved locally')
    }

    setForm({ producto: '', stock: '', precio: '', descripcion: '', categoria: '' })
    setEditingId(null)
    setShowForm(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleEdit = (product) => {
    setForm({
      producto: product.producto,
      stock: product.stock.toString(),
      precio: product.precio.toString(),
      descripcion: product.descripcion || '',
      categoria: product.categoria || '',
    })
    setEditingId(product.id)
    setShowForm(true)
    setActiveTab('list')
  }

  const openDeleteConfirm = (id) => {
    setProductToDelete(id)
    setShowDeleteConfirm(true)
  }

  const handleDelete = async () => {
    const id = productToDelete
    setShowDeleteConfirm(false)
    setProductToDelete(null)
    setProducts(products.filter(p => p.id !== id))
    try {
      await inventoryApi.deleteProduct(id)
    } catch (error) {
      console.log('Deleted locally')
    }
  }

  const cancelForm = () => {
    setForm({ producto: '', stock: '', precio: '', descripcion: '', categoria: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    console.log('[Upload] Archivo seleccionado:', file.name, file.size, 'bytes')
    
    setUploading(true)
    setUploadResult(null)
    setPreviewData(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await inventoryApi.uploadInventory(formData)
      console.log('[Upload] Respuesta:', response.data)
      
      if (response.data.preview && response.data.preview.length > 0) {
        setPreviewData(response.data.preview)
        setUploadResult({ success: true, message: `Se detectaron ${response.data.preview.length} productos` })
      } else if (response.data.error) {
        setUploadResult({ success: false, message: response.data.error })
      } else {
        setUploadResult({ success: false, message: 'No se encontraron productos en el archivo' })
      }
    } catch (error) {
      console.error('[Upload] Error:', error.response?.data || error.message)
      setUploadResult({ success: false, message: error.response?.data?.detail || 'Error al procesar archivo' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirmImport = async () => {
    if (!previewData) return
    
    setUploading(true)
    try {
      const response = await inventoryApi.confirmImport({ products: previewData })
      if (response.data.success) {
        await loadProducts()
        setPreviewData(null)
        setUploadResult({ success: true, message: `${response.data.imported} productos importados correctamente` })
        setSaved(true)
        setTimeout(() => {
          setSaved(false)
          setUploadResult(null)
        }, 3000)
      }
    } catch (error) {
      setUploadResult({ success: false, message: 'Error al importar productos' })
    } finally {
      setUploading(false)
    }
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const filteredProducts = products
    .filter(p => p.producto.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      const modifier = sortOrder === 'asc' ? 1 : -1
      if (typeof aVal === 'string') return aVal.localeCompare(bVal) * modifier
      return (aVal - bVal) * modifier
    })

  const totalValue = products.reduce((sum, p) => sum + (p.precio * p.stock), 0)
  const lowStockCount = products.filter(p => p.stock <= 5 && p.stock > 0).length
  const outOfStockCount = products.filter(p => p.stock === 0).length


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 text-sm">Gestiona productos y servicios</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm">
              <CheckCircle className="h-4 w-4" />
              Guardado
            </div>
          )}
          <Button variant="secondary" icon={Plus} onClick={() => { setShowForm(true); setActiveTab('list'); }}>
            Agregar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total productos</p>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Valor total</p>
          <p className="text-2xl font-bold text-emerald-600">${totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Stock bajo</p>
          <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Sin stock</p>
          <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Package className="h-4 w-4" />
          Lista
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'import' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Upload className="h-4 w-4" />
          Importar CSV
        </button>
      </div>

      {/* Tab: List */}
      {activeTab === 'list' && (
        <>
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                  </h3>
                  <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Input
                    label="Nombre"
                    value={form.producto}
                    onChange={(e) => setForm({ ...form, producto: e.target.value })}
                    placeholder="Corte de cabello"
                    required
                  />
                  <Input
                    label="Stock"
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    placeholder="10"
                    required
                  />
                  <Input
                    label="Precio (MXN)"
                    type="number"
                    step="0.01"
                    value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: e.target.value })}
                    placeholder="150.00"
                    required
                  />
                  <Input
                    label="Categoría"
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    placeholder="Servicios"
                  />
                </div>
                <Input
                  label="Descripción (opcional)"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Descripción del producto o servicio..."
                />
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={cancelForm}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingId ? 'Actualizar' : 'Agregar'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Search & Filter */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-sm text-gray-500">
                {filteredProducts.length} productos
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th 
                      className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('producto')}
                    >
                      <span className="flex items-center gap-1">
                        Producto
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </span>
                    </th>
                    <th 
                      className="text-center py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('stock')}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Stock
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </span>
                    </th>
                    <th 
                      className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('precio')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Precio
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-medium text-gray-900">{product.producto}</span>
                          {product.categoria && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                              {product.categoria}
                            </span>
                          )}
                          {product.descripcion && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{product.descripcion}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                          product.stock > 5 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : product.stock > 0 
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-900">
                        ${product.precio?.toFixed(2) || '0.00'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(product.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <p className="text-center text-gray-500 py-12">
                  {searchTerm ? 'No se encontraron productos' : 'No hay productos. Agrega el primero.'}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tab: Import */}
      {activeTab === 'import' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload Area */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Importar Inventario</h3>
                  <p className="text-sm text-gray-500">Sube un archivo CSV o Excel</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group"
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
                    <p className="text-sm text-gray-600">Procesando archivo...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-gray-100 rounded-xl group-hover:bg-emerald-100 transition-colors">
                      <Upload className="h-8 w-8 text-gray-400 group-hover:text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-gray-700">Arrastra o selecciona un archivo</p>
                      <p className="text-sm text-gray-500 mt-1">Formatos: CSV o Excel (.xlsx, .xls)</p>
                    </div>
                  </div>
                )}
              </button>

              {uploadResult && (
                <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 ${
                  uploadResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {uploadResult.success ? (
                    <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm">{uploadResult.message}</p>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Table className="h-5 w-5 text-gray-500" />
                Formato del archivo
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Tu archivo debe tener:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Primera fila con nombres de columnas</li>
                  <li>Una columna con el nombre del producto</li>
                  <li>Columnas opcionales: stock, precio, categoría</li>
                </ul>
                <p className="mt-3 text-gray-500">El sistema detecta automáticamente qué columna es cada campo.</p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Eye className="h-5 w-5 text-gray-500" />
                Vista previa
              </h3>
            </div>
            
            {previewData ? (
              <>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Producto</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-600">Stock</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">Precio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <span className="font-medium text-gray-900">{item.producto}</span>
                            {item.categoria && (
                              <span className="ml-2 text-xs text-gray-500">({item.categoria})</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-gray-600">{item.stock}</td>
                          <td className="py-2 px-3 text-right font-mono text-gray-900">${item.precio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-sm text-gray-500">{previewData.length} productos listos</p>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => setPreviewData(null)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleConfirmImport} loading={uploading}>
                      Importar Todo
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Sube un archivo para ver la vista previa</p>
                <p className="text-sm mt-1">La IA detectará automáticamente los productos</p>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setProductToDelete(null) }}
        onConfirm={handleDelete}
        title="¿Eliminar este producto?"
        message="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  )
}

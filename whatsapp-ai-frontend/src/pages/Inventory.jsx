import { useState, useEffect } from 'react'
import { Package, Plus, Pencil, Trash2, X, CheckCircle } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { Input } from '../components/Input'
import { inventoryApi } from '../api/client'

const defaultProducts = [
  { id: 1, producto: 'Corte de cabello', stock: 10, precio: 150 },
  { id: 2, producto: 'Barba', stock: 5, precio: 100 },
  { id: 3, producto: 'Shampoo premium', stock: 20, precio: 250 },
]

export default function Inventory() {
  const [products, setProducts] = useState(defaultProducts)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ producto: '', stock: '', precio: '' })
  const [saved, setSaved] = useState(false)

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

    setForm({ producto: '', stock: '', precio: '' })
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
    })
    setEditingId(product.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return
    setProducts(products.filter(p => p.id !== id))
    try {
      await inventoryApi.deleteProduct(id)
    } catch (error) {
      console.log('Deleted locally')
    }
  }

  const cancelForm = () => {
    setForm({ producto: '', stock: '', precio: '' })
    setEditingId(null)
    setShowForm(false)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 mt-1">Gestiona productos y servicios</p>
        </div>
        <Button icon={Plus} onClick={() => setShowForm(true)}>
          Agregar Producto
        </Button>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
          <CheckCircle className="h-5 w-5" />
          <span>Cambios guardados</span>
        </div>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Nombre del producto/servicio"
                value={form.producto}
                onChange={(e) => setForm({ ...form, producto: e.target.value })}
                placeholder="Corte de cabello"
                required
              />
              <Input
                label="Stock disponible"
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
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={cancelForm}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingId ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Productos y Servicios" icon={Package}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Producto/Servicio</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Stock</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Precio</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{product.producto}</span>
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
                    ${product.precio.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No hay productos. Agrega el primero.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

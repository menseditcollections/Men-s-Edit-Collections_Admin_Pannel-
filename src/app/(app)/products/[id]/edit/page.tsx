import { notFound } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { store } from "@/lib/store";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await store.products.get(id);
  if (!product) notFound();

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Edit Product</h1>
      <p className="text-sm text-neutral-500 mb-6">Update product details. Manage sizes and stock on the product page.</p>
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <ProductForm product={product} />
      </div>
    </div>
  );
}

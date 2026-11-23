import ProductForm from "@/components/ProductForm";

export default function NewProductPage() {
  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Add Product</h1>
      <p className="text-sm text-neutral-500 mb-6">Fill in the details below. You can set stock quantities after adding.</p>
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <ProductForm />
      </div>
    </div>
  );
}

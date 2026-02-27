export function Input({ className = '', ...props }) {
  return <input {...props} className={`w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white ${className}`} />
}


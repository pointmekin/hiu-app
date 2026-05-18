import { useQuery } from "@tanstack/react-query"
import { Package } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { Product } from "#/db/schema"
import { listProducts } from "#/server/functions/products/list"
import { useDebounce } from "#/lib/use-debounce"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "#/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog"

interface CatalogPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  excludeIds: string[]
  onSelect: (product: Product) => void
}

export function CatalogPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  onSelect,
}: CatalogPickerDialogProps) {
  const { t } = useTranslation(["rounds", "products"])
  const [q, setQ] = useState("")
  const debouncedQ = useDebounce(q, 250)

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products", debouncedQ],
    queryFn: () => listProducts({ data: { q: debouncedQ, limit: 30 } }),
    enabled: open,
  })

  const available = allProducts.filter((p) => !excludeIds.includes(p.id))

  function handleSelect(product: Product) {
    onSelect(product)
    onOpenChange(false)
    setQ("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-auto bottom-0 left-0 right-0 translate-x-0 translate-y-0 max-w-none rounded-t-2xl rounded-b-none data-[state=open]:slide-in-from-bottom-4 sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:right-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:rounded-2xl sm:data-[state=open]:slide-in-from-bottom-0 p-0"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("rounds:products.addProduct")}</DialogTitle>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("rounds:products.searchCatalog")}
            value={q}
            onValueChange={setQ}
          />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>{t("products:list.empty")}</CommandEmpty>
            {available.map((product) => (
              <CommandItem
                key={product.id}
                value={product.id}
                onSelect={() => handleSelect(product)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
              >
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {product.thumbUrl ? (
                    <img
                      src={product.thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package size={18} className="text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{product.name}</p>
                  {product.brand && (
                    <p className="text-xs text-muted-foreground">{product.brand}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

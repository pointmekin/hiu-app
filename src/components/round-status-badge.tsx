import { useTranslation } from "react-i18next"
import { Badge } from "#/components/ui/badge"
import { cn } from "#/lib/utils"
import type { RoundStatus } from "#/shared/schemas/round"

const statusClasses: Record<RoundStatus, string> = {
  draft: "bg-muted text-muted-foreground hover:bg-muted",
  open: "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
  shipping: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
  done: "bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400",
  archived: "bg-muted text-muted-foreground opacity-60 hover:bg-muted",
}

interface RoundStatusBadgeProps {
  status: RoundStatus
  className?: string
}

export function RoundStatusBadge({ status, className }: RoundStatusBadgeProps) {
  const { t } = useTranslation("rounds")

  return (
    <Badge className={cn("shrink-0 rounded-full", statusClasses[status], className)}>
      {t(`status.${status}`)}
    </Badge>
  )
}

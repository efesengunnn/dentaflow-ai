"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

type SearchInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "type"
> & {
  onClear?: () => void
}

function SearchInput({
  className,
  onClear,
  value,
  ...props
}: SearchInputProps) {
  const hasValue = typeof value === "string" && value.length > 0

  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <SearchIcon className="size-4" />
      </InputGroupAddon>
      <InputGroupInput
        data-slot="search-input"
        type="search"
        value={value}
        {...props}
      />
      {onClear && hasValue && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={onClear}
            aria-label="Aramayı temizle"
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

export { SearchInput }

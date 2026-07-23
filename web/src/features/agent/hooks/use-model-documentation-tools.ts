/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useState } from 'react'

import { modelDocumentationToolPack } from '../lib/tools/builtins/model-documentation'

const ENABLED_TOOL_PACKS = [modelDocumentationToolPack]
const DISABLED_TOOL_PACKS: typeof ENABLED_TOOL_PACKS = []

export function useModelDocumentationTools() {
  const [enabled, setEnabled] = useState(true)
  const toggle = useCallback(() => setEnabled((current) => !current), [])

  return {
    enabled,
    toggle,
    toolPacks: enabled ? ENABLED_TOOL_PACKS : DISABLED_TOOL_PACKS,
  }
}

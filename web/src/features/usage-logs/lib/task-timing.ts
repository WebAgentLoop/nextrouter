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
export type TaskTiming = {
  totalDurationSec?: number
  queueDurationSec?: number
  executionDurationSec?: number
}

function isTimestamp(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function calculateTaskTiming(
  submitTime?: number,
  startTime?: number,
  finishTime?: number
): TaskTiming {
  const timing: TaskTiming = {}

  if (isTimestamp(submitTime) && isTimestamp(finishTime)) {
    timing.totalDurationSec = Math.max(0, finishTime - submitTime)
  }
  if (isTimestamp(submitTime) && isTimestamp(startTime)) {
    timing.queueDurationSec = Math.max(0, startTime - submitTime)
  }
  if (isTimestamp(startTime) && isTimestamp(finishTime)) {
    timing.executionDurationSec = Math.max(0, finishTime - startTime)
  }

  return timing
}

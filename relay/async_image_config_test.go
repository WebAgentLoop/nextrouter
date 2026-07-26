package relay

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAsyncImageWorkerConcurrencyUsesConfiguredValueWithinBounds(t *testing.T) {
	t.Setenv("ASYNC_IMAGE_WORKER_CONCURRENCY", "12")

	assert.Equal(t, 12, asyncImageWorkerConcurrency())
}

func TestAsyncImageWorkerConcurrencyFallsBackForInvalidValues(t *testing.T) {
	for _, value := range []string{"0", strconv.Itoa(asyncImageMaxConcurrency + 1), "invalid"} {
		t.Run(value, func(t *testing.T) {
			t.Setenv("ASYNC_IMAGE_WORKER_CONCURRENCY", value)

			assert.Equal(t, asyncImageDefaultConcurrency, asyncImageWorkerConcurrency())
		})
	}
}

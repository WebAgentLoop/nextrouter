package service

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldRetryRelayUsesRemainingAttempts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	upstreamErr := types.NewOpenAIError(errors.New("upstream unavailable"), types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError)

	require.NotNil(t, c)
	assert.True(t, ShouldRetryRelay(c, upstreamErr, 1))
	assert.False(t, ShouldRetryRelay(c, upstreamErr, 0))
}

func TestShouldRetryRelayHonorsSkipRetryError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	skipErr := types.NewError(errors.New("invalid request"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())

	require.NotNil(t, c)
	assert.False(t, ShouldRetryRelay(c, skipErr, 3))
}

func TestShouldRetryRelayNeverRetriesSpecificChannel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("specific_channel_id", "42")
	channelErr := types.NewError(errors.New("channel unavailable"), types.ErrorCodeChannelNoAvailableKey)

	require.NotNil(t, c)
	assert.False(t, ShouldRetryRelay(c, channelErr, 3))
}

func TestRestoreChannelAffinitySkipRetryStopsRetry(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	RestoreChannelAffinitySkipRetry(c, true)
	upstreamErr := types.NewOpenAIError(errors.New("upstream unavailable"), types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError)

	require.True(t, ShouldSkipRetryAfterChannelAffinityFailure(c))
	assert.False(t, ShouldRetryRelay(c, upstreamErr, 3))
}

package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAsyncImageRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	require.NotPanics(t, func() { SetRelayRouter(engine) })

	routes := make(map[string]struct{}, len(engine.Routes()))
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = struct{}{}
	}
	_, hasSubmit := routes[http.MethodPost+" /v1/images/generations/async"]
	_, hasFetch := routes[http.MethodGet+" /v1/images/generations/tasks/:task_id"]
	_, hasResult := routes[http.MethodGet+" /v1/images/generations/tasks/:task_id/result"]
	assert.True(t, hasSubmit)
	assert.True(t, hasFetch)
	assert.False(t, hasResult)
}

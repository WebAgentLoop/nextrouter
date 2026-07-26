package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestUpdateOptionRejectsInvalidAsyncImageSettings(t *testing.T) {
	tests := []struct {
		name    string
		key     string
		value   string
		message string
	}{
		{
			name: "pending task limit above maximum", key: "async_image_setting.max_pending_per_user", value: "1001",
			message: "Async image maximum pending tasks per user must be between 1 and 1000",
		},
		{
			name: "upstream timeout below minimum", key: "async_image_setting.upstream_timeout_seconds", value: "0",
			message: "Async image upstream timeout must be between 1 and 3600 seconds",
		},
		{
			name: "retention is not a number", key: "async_image_setting.task_retention_hours", value: "invalid",
			message: "Async image task retention must be between 1 and 720 hours",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			body := `{"key":"` + test.key + `","value":"` + test.value + `"}`
			context.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(body))

			UpdateOption(context)

			assert.Equal(t, http.StatusOK, response.Code)
			assert.JSONEq(t, `{"success":false,"message":"`+test.message+`"}`, response.Body.String())
		})
	}
}

package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/setting/ticket_setting"

	"github.com/gin-gonic/gin"
)

func TicketEnabledRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !ticket_setting.IsTicketEnabled() {
			c.AbortWithStatusJSON(http.StatusOK, gin.H{"success": false, "message": "Ticket system is disabled"})
			return
		}
		c.Next()
	}
}

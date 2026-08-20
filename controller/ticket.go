package controller

import (
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func CreateTicket(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")
	if userId == 0 {
		common.ApiErrorMsg(c, "user not found")
		return
	}
	var req struct {
		Title    string `json:"title"`
		Content  string `json:"content"`
		Priority int    `json:"priority"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid params: "+err.Error())
		return
	}
	title := strings.TrimSpace(req.Title)
	content := strings.TrimSpace(req.Content)
	if utf8.RuneCountInString(title) < 1 || utf8.RuneCountInString(title) > 200 {
		common.ApiErrorMsg(c, "title 长度必须在 1-200 字符之间")
		return
	}
	if utf8.RuneCountInString(content) < 1 || utf8.RuneCountInString(content) > 2000 {
		common.ApiErrorMsg(c, "content 长度必须在 1-2000 字符之间")
		return
	}
	if req.Priority < 0 || req.Priority > 3 {
		common.ApiErrorMsg(c, "priority 必须在 0-3 之间")
		return
	}
	ticket := &model.Ticket{
		UserId:   userId,
		Username: username,
		Title:    title,
		Content:  content,
		Status:   model.TicketStatusOpen,
		Priority: req.Priority,
	}
	if err := model.CreateTicket(ticket); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

func ListTickets(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	status := c.Query("status")
	keyword := c.Query("keyword")
	tickets, total, err := model.GetUserTickets(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), status, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func GetTicket(c *gin.Context) {
	userId := c.GetInt("id")
	role := c.GetInt("role")
	idStr := c.Param("id")
	ticketId, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "invalid ticket id")
		return
	}
	ticket, err := model.GetTicketById(ticketId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if ticket.UserId != userId && role < common.RoleAdminUser {
		common.ApiErrorMsg(c, "无权访问该工单")
		return
	}
	messages, err := model.GetTicketMessages(ticketId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ticket": ticket, "messages": messages})
}

func ReplyTicket(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")
	role := c.GetInt("role")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid ticket id")
		return
	}
	ticket, err := model.GetTicketById(ticketId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if ticket.UserId != userId && role < common.RoleAdminUser {
		common.ApiErrorMsg(c, "无权操作该工单")
		return
	}
	if ticket.Status == model.TicketStatusClosed {
		common.ApiErrorMsg(c, "工单已关闭，无法回复")
		return
	}
	var req struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid params: "+err.Error())
		return
	}
	content := strings.TrimSpace(req.Content)
	if utf8.RuneCountInString(content) < 1 || utf8.RuneCountInString(content) > 2000 {
		common.ApiErrorMsg(c, "content 长度必须在 1-2000 字符之间")
		return
	}
	msgRole := model.TicketMessageRoleUser
	newStatus := model.TicketStatusPending
	if role >= common.RoleAdminUser {
		msgRole = model.TicketMessageRoleAdmin
		newStatus = model.TicketStatusAnswered
	}
	msg := &model.TicketMessage{
		TicketId: ticketId,
		UserId:   userId,
		Username: username,
		Role:     msgRole,
		Content:  content,
	}
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(msg).Error; err != nil {
			return err
		}
		updates := map[string]interface{}{"status": newStatus}
		if newStatus == model.TicketStatusClosed {
			updates["closed_at"] = common.GetTimestamp()
		} else {
			updates["closed_at"] = 0
		}
		return tx.Model(&model.Ticket{}).Where("id = ?", ticketId).Updates(updates).Error
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, msg)
}

func CloseTicket(c *gin.Context) {
	userId := c.GetInt("id")
	role := c.GetInt("role")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid ticket id")
		return
	}
	ticket, err := model.GetTicketById(ticketId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if ticket.UserId != userId && role < common.RoleAdminUser {
		common.ApiErrorMsg(c, "无权操作该工单")
		return
	}
	if ticket.Status == model.TicketStatusClosed {
		common.ApiErrorMsg(c, "工单已关闭")
		return
	}
	if err := model.UpdateTicketStatus(ticketId, model.TicketStatusClosed); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"success": true})
}

func AdminListTickets(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := c.Query("status")
	keyword := c.Query("keyword")
	var userId *int
	if userIdStr := c.Query("user_id"); userIdStr != "" {
		uid, err := strconv.Atoi(userIdStr)
		if err != nil {
			common.ApiErrorMsg(c, "invalid user_id")
			return
		}
		userId = &uid
	}
	tickets, total, err := model.GetAllTickets(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), status, keyword, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func AdminReplyTicket(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid ticket id")
		return
	}
	ticket, err := model.GetTicketById(ticketId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if ticket.Status == model.TicketStatusClosed {
		common.ApiErrorMsg(c, "工单已关闭，无法回复")
		return
	}
	var req struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid params: "+err.Error())
		return
	}
	content := strings.TrimSpace(req.Content)
	if utf8.RuneCountInString(content) < 1 || utf8.RuneCountInString(content) > 2000 {
		common.ApiErrorMsg(c, "content 长度必须在 1-2000 字符之间")
		return
	}
	msg := &model.TicketMessage{
		TicketId: ticketId,
		UserId:   userId,
		Username: username,
		Role:     model.TicketMessageRoleAdmin,
		Content:  content,
	}
	newStatus := model.TicketStatusAnswered
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(msg).Error; err != nil {
			return err
		}
		updates := map[string]interface{}{"status": newStatus}
		if newStatus == model.TicketStatusClosed {
			updates["closed_at"] = common.GetTimestamp()
		} else {
			updates["closed_at"] = 0
		}
		return tx.Model(&model.Ticket{}).Where("id = ?", ticketId).Updates(updates).Error
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, msg)
}

func AdminUpdateTicketStatus(c *gin.Context) {
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid ticket id")
		return
	}
	if _, err := model.GetTicketById(ticketId); err != nil {
		common.ApiError(c, err)
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid params: "+err.Error())
		return
	}
	if req.Status != model.TicketStatusOpen && req.Status != model.TicketStatusPending && req.Status != model.TicketStatusAnswered && req.Status != model.TicketStatusClosed {
		common.ApiErrorMsg(c, "invalid status")
		return
	}
	if err := model.UpdateTicketStatus(ticketId, req.Status); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"success": true})
}

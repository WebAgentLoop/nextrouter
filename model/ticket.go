package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	TicketStatusOpen     = "open"
	TicketStatusPending  = "pending"
	TicketStatusAnswered = "answered"
	TicketStatusClosed   = "closed"
)

const (
	TicketPriorityLow    = 0
	TicketPriorityMedium = 1
	TicketPriorityHigh   = 2
	TicketPriorityUrgent = 3
)

const TicketSearchHardLimit = 10000

const (
	TicketMessageRoleUser  = "user"
	TicketMessageRoleAdmin = "admin"
)

type Ticket struct {
	Id        int            `json:"id" gorm:"primaryKey"`
	UserId    int            `json:"user_id" gorm:"index;index:idx_ticket_user_status"`
	Username  string         `json:"username" gorm:"type:varchar(64);index"`
	Title     string         `json:"title" gorm:"type:varchar(200);index"`
	Content   string         `json:"content" gorm:"type:text"`
	Status    string         `json:"status" gorm:"type:varchar(20);index;index:idx_ticket_user_status;default:'open'"`
	Priority  int            `json:"priority" gorm:"default:0;index"`
	CreatedAt int64          `json:"created_at" gorm:"bigint;index;autoCreateTime"`
	UpdatedAt int64          `json:"updated_at" gorm:"bigint;autoUpdateTime"`
	ClosedAt  int64          `json:"closed_at" gorm:"bigint;index;default:0"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

type TicketMessage struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	TicketId  int    `json:"ticket_id" gorm:"index"`
	UserId    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"type:varchar(64)"`
	// Role indicates the sender role, allowed values: "user" (TicketMessageRoleUser) or "admin" (TicketMessageRoleAdmin).
	Role      string `json:"role" gorm:"type:varchar(20);default:'user'"`
	Content   string `json:"content" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index;autoCreateTime"`
}

func CreateTicket(ticket *Ticket) error {
	return DB.Create(ticket).Error
}

func GetTicketById(id int) (*Ticket, error) {
	var ticket Ticket
	if err := DB.First(&ticket, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &ticket, nil
}

func GetUserTickets(userId, offset, limit int, status string, keyword string) ([]*Ticket, int64, error) {
	query := DB.Model(&Ticket{}).Where("user_id = ?", userId)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		pattern, err := sanitizeLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		query = query.Where("(title LIKE ? ESCAPE '!' OR content LIKE ? ESCAPE '!')", pattern, pattern)
	}
	var total int64
	countQuery := query.Session(&gorm.Session{})
	if err := countQuery.Limit(TicketSearchHardLimit).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var tickets []*Ticket
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&tickets).Error; err != nil {
		return nil, 0, err
	}
	return tickets, total, nil
}

func GetAllTickets(offset, limit int, status string, keyword string, userId *int) ([]*Ticket, int64, error) {
	query := DB.Model(&Ticket{})
	if userId != nil {
		query = query.Where("user_id = ?", *userId)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		pattern, err := sanitizeLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		query = query.Where("(title LIKE ? ESCAPE '!' OR content LIKE ? ESCAPE '!')", pattern, pattern)
	}
	var total int64
	countQuery := query.Session(&gorm.Session{})
	if err := countQuery.Limit(TicketSearchHardLimit).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var tickets []*Ticket
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&tickets).Error; err != nil {
		return nil, 0, err
	}
	return tickets, total, nil
}

func UpdateTicketStatus(id int, status string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if status == TicketStatusClosed {
		updates["closed_at"] = common.GetTimestamp()
	} else {
		updates["closed_at"] = 0
	}
	return DB.Model(&Ticket{}).Where("id = ?", id).Updates(updates).Error
}

func CloseTicket(id int, userId int) error {
	ticket, err := GetTicketById(id)
	if err != nil {
		return err
	}
	if ticket.UserId != userId {
		return errors.New("无权操作该工单")
	}
	return DB.Model(&Ticket{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":    TicketStatusClosed,
		"closed_at": common.GetTimestamp(),
	}).Error
}

func CreateTicketMessage(msg *TicketMessage) error {
	return DB.Create(msg).Error
}

func GetTicketMessages(ticketId int) ([]*TicketMessage, error) {
	var messages []*TicketMessage
	if err := DB.Where("ticket_id = ?", ticketId).Order("id asc").Find(&messages).Error; err != nil {
		return nil, err
	}
	return messages, nil
}

func CountUserTickets(userId int) (int64, error) {
	var total int64
	if err := DB.Model(&Ticket{}).Where("user_id = ?", userId).Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

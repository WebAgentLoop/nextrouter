package model

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAsyncImageTaskClaimAndFinishLifecycle(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID: "imgtask_lifecycle", Platform: constant.TaskPlatformAsyncImage,
		UserId: 7, Status: TaskStatusQueued, Progress: "0%", SubmitTime: 100,
		PrivateData: TaskPrivateData{AsyncImageRequest: json.RawMessage(`{"model":"image-model","prompt":"test"}`)},
	}
	insertTask(t, task)

	claimed, err := ClaimAsyncImageTasks("runner-a", 200, 260, 1)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	assert.Equal(t, task.TaskID, claimed[0].TaskID)
	assert.Equal(t, TaskStatus(TaskStatusInProgress), claimed[0].Status)
	assert.Equal(t, 1, claimed[0].Attempts)

	claimedAgain, err := ClaimAsyncImageTasks("runner-b", 201, 261, 1)
	require.NoError(t, err)
	assert.Empty(t, claimedAgain)
	assert.False(t, RenewAsyncImageTaskLease(task.TaskID, "runner-b", 300))
	assert.True(t, RenewAsyncImageTaskLease(task.TaskID, "runner-a", 300))

	result := json.RawMessage(`{"created":300,"data":[{"b64_json":"aGVsbG8="}]}`)
	owned, err := BeginAsyncImageSettlement(task.TaskID, "runner-a", result)
	require.NoError(t, err)
	assert.True(t, owned)
	owned, err = BeginAsyncImageSettlement(task.TaskID, "runner-a", result)
	require.NoError(t, err)
	assert.False(t, owned)
	won, err := FinishAsyncImageTask(task.TaskID, "runner-a", TaskStatusSuccess, result, "", 300, 86_700)
	require.NoError(t, err)
	assert.True(t, won)

	finished, exists, err := GetByTaskId(task.UserId, task.TaskID)
	require.NoError(t, err)
	require.True(t, exists)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), finished.Status)
	assert.JSONEq(t, string(result), string(finished.AsyncImageResult))
	assert.EqualValues(t, 86_700, finished.ExpiresAt)
	assert.Equal(t, "settled", finished.BillingStatus)
}

func TestAsyncImageTaskPollingExclusionAndExpiryCleanup(t *testing.T) {
	truncateTables(t)
	queued := &Task{
		TaskID: "imgtask_queued", Platform: constant.TaskPlatformAsyncImage,
		UserId: 8, Status: TaskStatusQueued, Progress: "0%", SubmitTime: 100,
	}
	expired := &Task{
		TaskID: "imgtask_expired", Platform: constant.TaskPlatformAsyncImage,
		UserId: 8, Status: TaskStatusSuccess, Progress: "100%", SubmitTime: 50,
		FinishTime: 60, ExpiresAt: 200, Data: json.RawMessage(`{"data":[]}`),
	}
	insertTask(t, queued)
	insertTask(t, expired)

	assert.False(t, HasUnfinishedSyncTasks())
	assert.Empty(t, GetAllUnFinishSyncTasks(10))

	deleted, err := DeleteExpiredAsyncImageTasks(199, 10)
	require.NoError(t, err)
	assert.Zero(t, deleted)
	deleted, err = DeleteExpiredAsyncImageTasks(200, 10)
	require.NoError(t, err)
	assert.EqualValues(t, 1, deleted)

	_, exists, err := GetByTaskId(expired.UserId, expired.TaskID)
	require.NoError(t, err)
	assert.False(t, exists)
	_, exists, err = GetByTaskId(queued.UserId, queued.TaskID)
	require.NoError(t, err)
	assert.True(t, exists)
}

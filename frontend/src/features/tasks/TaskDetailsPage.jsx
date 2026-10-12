// מסך פרטי משימה.
// חלקים עיקריים: פרטים ועריכה, תת-משימות, תלויות חוסמות, קבצים מצורפים, תגובות, היסטוריה.

import { useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import BlockIcon from '@mui/icons-material/Block';
import AddIcon from '@mui/icons-material/Add';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { PriorityChip } from '../../components/common/PriorityChip';
import { UserAvatar, UserIdentity } from '../../components/common/UserAvatar';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, LoadingState } from '../../components/common/States';
import { useAuth } from '../../auth/AuthContext';
import {
  useAddAttachment,
  useAddComment,
  useArchiveTask,
  useAttachments,
  useBoard,
  useComments,
  useDeleteComment,
  useDeleteTask,
  useLabels,
  useOrganizationUsers,
  useProject,
  useTask,
  useTaskActivity,
  useTasks,
  useAddTaskDependency,
  useRemoveTaskDependency,
  useUpdateComment,
  useUpdateTask,
} from '../../lib/queries';
import { TaskFormDialog } from './TaskFormDialog';
import { isOverdue } from '../../lib/taskStatus';
import { downloadAttachment } from '../../api/api';
import { formatDate, formatDateTime, formatFileSize, formatHours, fullName } from '../../lib/format';
import { projectAbility } from '../../lib/permissions';
import { ContactButtons } from '../../components/common/ContactButtons';

// כל פרטי המשימה: עריכה, תגובות, קבצים, תלויות והיסטוריה.
// נקרא מ: App.jsx
export function TaskDetailsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user, activeRole } = useAuth();
  const { data: task, isLoading } = useTask(taskId);
  const { data: project } = useProject(task?.projectId);
  const { data: board } = useBoard(task?.projectId);
  const { data: users } = useOrganizationUsers();
  const { data: labels = [] } = useLabels();
  const { data: comments = [] } = useComments(taskId);
  const { data: attachments = [] } = useAttachments(taskId);
  const { data: taskActivity = [] } = useTaskActivity(taskId);
  const { data: projectTasks = [] } = useTasks(task?.projectId ? { projectId: task.projectId } : {});

  const updateTask = useUpdateTask();
  const addComment = useAddComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const addAttachment = useAddAttachment();
  const archiveTask = useArchiveTask();
  const deleteTask = useDeleteTask();
  const addDependency = useAddTaskDependency();
  const removeDependency = useRemoveTaskDependency();

  const [commentBody, setCommentBody] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingBody, setEditingBody] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [subtaskDialogOpen, setSubtaskDialogOpen] = useState(false);
  const [dependencyId, setDependencyId] = useState('');
  const fileInputRef = useRef(null);

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  if (isLoading) return <LoadingState label="Loading task…" />;
  if (!task) return <EmptyState title="Task not found" description="This task may have been deleted or you may not have access." />;

  // מה מותר למשתמש המחובר לעשות במשימה הזו - נקבע בשרת לכל פרויקט
  // (הרשאות התפקיד + שינויי הארגון + חריגים אישיים + בעלות על הפרויקט).
  const canManage = projectAbility(activeRole, project, 'manageTasks');
  const canCreateTasks = projectAbility(activeRole, project, 'createTasks');
  const canMoveOwnTasks = projectAbility(activeRole, project, 'moveOwnTasks');
  const canComment = projectAbility(activeRole, project, 'comment');
  const canUpload = projectAbility(activeRole, project, 'upload');
  const canModerate = projectAbility(activeRole, project, 'moderate');
  const isAssignee = task.assigneeId === user?.id;
  const canEditStatus = canManage || (isAssignee && canMoveOwnTasks);
  const overdue = isOverdue(task);
  const creator = userMap.get(task.creatorId);
  const taskLabels = task.labelIds.map((id) => labels.find((l) => l.id === id)).filter((l) => !!l);
  const members = project ? project.memberIds.map((id) => userMap.get(id)).filter((u) => !!u) : [];

  const handleSubmitComment = async () => {
    if (!commentBody.trim() || !user) return;
    await addComment.mutateAsync({ taskId: task.id, authorId: user.id, body: commentBody.trim() });
    setCommentBody('');
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    try {
      await addAttachment.mutateAsync({ taskId: task.id, file });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to upload this file.');
    }
  };

  return (
    <Box>
      <Breadcrumbs
        items={[
          { label: 'My Tasks', to: '/my-tasks' },
          ...(project ? [{ label: project.name, to: `/projects/${project.id}` }] : []),
          { label: task.title },
        ]}
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-start' }}
        spacing={1.5}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="h1" sx={{ fontSize: '1.5rem' }}>
              {task.title}
            </Typography>
            {task.blocked && <Chip icon={<BlockIcon sx={{ fontSize: 15 }} />} label="Blocked" color="error" size="small" />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            in {project?.name ?? 'Unknown project'}
          </Typography>
        </Box>
        {canManage && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" color="inherit" startIcon={<ArchiveOutlinedIcon />} onClick={() => setConfirmArchive(true)}>
              {task.archived ? 'Restore' : 'Archive'}
            </Button>
            <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </Stack>
        )}
      </Stack>

      {overdue && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          This task is overdue. It was due on {formatDate(task.dueDate)}.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1 }}>
                Description
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {task.description || 'No description provided.'}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h4">Subtasks ({task.subtasks.length})</Typography>
                {canCreateTasks && <Button size="small" startIcon={<AddIcon />} onClick={() => setSubtaskDialogOpen(true)}>Add subtask</Button>}
              </Stack>
              {task.subtasks.length === 0 ? <Typography variant="body2" color="text.secondary">No subtasks yet.</Typography> : (
                <List dense>{task.subtasks.map((subtask) => (
                  <ListItem key={subtask.id} divider sx={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/${subtask.id}`)}>
                    <ListItemText primary={subtask.title} secondary={subtask.completedAt ? 'Completed' : 'Open'} />
                  </ListItem>
                ))}</List>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>Blocking dependencies</Typography>
              {task.dependencies.map((id) => {
                const dependency = projectTasks.find((item) => item.id === id);
                return <Chip key={id} label={dependency?.title ?? id} onDelete={canManage ? () => removeDependency.mutate({ taskId: task.id, dependsOnTaskId: id }) : undefined} onClick={() => navigate(`/tasks/${id}`)} sx={{ mr: 1, mb: 1 }} />;
              })}
              {canManage && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <TextField select size="small" label="Add dependency" value={dependencyId} onChange={(e) => setDependencyId(e.target.value)} fullWidth>
                    {projectTasks.filter((item) => item.id !== task.id && !task.dependencies.includes(item.id)).map((item) => <MenuItem key={item.id} value={item.id}>{item.title}</MenuItem>)}
                  </TextField>
                  <Button disabled={!dependencyId || addDependency.isPending} onClick={async () => { await addDependency.mutateAsync({ taskId: task.id, dependsOnTaskId: dependencyId }); setDependencyId(''); }}>Add</Button>
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h4">Attachments ({attachments.length})</Typography>
                {canUpload && (
                  <Button
                    size="small"
                    startIcon={<UploadFileOutlinedIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={addAttachment.isPending}
                  >
                    {addAttachment.isPending ? 'Uploading…' : 'Upload file'}
                  </Button>
                )}
                <input ref={fileInputRef} type="file" hidden onChange={handleFileSelected} />
              </Stack>
              {uploadError && (
                <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setUploadError(null)}>
                  {uploadError}
                </Alert>
              )}
              {attachments.length === 0 ? (
                <EmptyState title="No attachments yet" description="Files up to 10MB (PDF, images, Office documents) are supported." />
              ) : (
                <List dense>
                  {attachments.map((a) => {
                    const uploader = userMap.get(a.uploadedById);
                    return (
                      <ListItem key={a.id} divider onClick={() => downloadAttachment(a.id, a.fileName)} sx={{ cursor: 'pointer' }}>
                        <ListItemAvatar>
                          <Avatar variant="rounded" sx={{ bgcolor: '#EEF0F5', color: 'text.secondary' }}>
                            <InsertDriveFileOutlinedIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={a.fileName}
                          secondary={`${formatFileSize(a.sizeKb)} · ${uploader ? fullName(uploader) : 'Unknown'} · ${formatDate(a.uploadedAt)}`}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                Comments ({comments.length})
              </Typography>
              <Stack spacing={2} sx={{ mb: 2 }}>
                {comments.map((c) => {
                  const author = userMap.get(c.authorId);
                  const canEditComment = c.authorId === user?.id;
                  const canDeleteComment = canEditComment || canModerate; // מודרציה: מחיקת תגובות של אחרים
                  const isEditing = editingCommentId === c.id;
                  return (
                    <Box key={c.id}>
                      <Stack direction="row" spacing={1.25}>
                        <UserAvatar user={author} size="small" />
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="baseline">
                            <Typography variant="body2" fontWeight={700}>
                              {author ? fullName(author) : 'Unknown'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDateTime(c.createdAt)}
                              {c.editedAt ? ' (edited)' : ''}
                            </Typography>
                          </Stack>
                          {isEditing ? (
                            <Stack spacing={1} sx={{ mt: 0.5 }}>
                              <TextField
                                value={editingBody}
                                onChange={(e) => setEditingBody(e.target.value)}
                                multiline
                                minRows={2}
                                fullWidth
                                size="small"
                              />
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={async () => {
                                    await updateComment.mutateAsync({ commentId: c.id, body: editingBody });
                                    setEditingCommentId(null);
                                  }}
                                >
                                  Save
                                </Button>
                                <Button size="small" onClick={() => setEditingCommentId(null)}>
                                  Cancel
                                </Button>
                              </Stack>
                            </Stack>
                          ) : (
                            <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>
                              {c.body}
                            </Typography>
                          )}
                          {canDeleteComment && !isEditing && (
                            <Stack direction="row" spacing={1.5} sx={{ mt: 0.25 }}>
                              {canEditComment && (
                                <Typography
                                  variant="caption"
                                  color="primary.main"
                                  sx={{ cursor: 'pointer', fontWeight: 600 }}
                                  onClick={() => {
                                    setEditingCommentId(c.id);
                                    setEditingBody(c.body);
                                  }}
                                >
                                  Edit
                                </Typography>
                              )}
                              <Typography
                                variant="caption"
                                color="error.main"
                                sx={{ cursor: 'pointer', fontWeight: 600 }}
                                onClick={() => deleteComment.mutate(c.id)}
                              >
                                Delete
                              </Typography>
                            </Stack>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
                {comments.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No comments yet. Start the conversation.
                  </Typography>
                )}
              </Stack>
              {canComment && <Divider sx={{ mb: 2 }} />}
              {canComment && (
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <UserAvatar user={user} size="small" />
                <Box sx={{ flex: 1 }}>
                  <TextField
                    placeholder="Add a comment…"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                  />
                  <Button
                    sx={{ mt: 1 }}
                    variant="contained"
                    size="small"
                    onClick={handleSubmitComment}
                    disabled={!commentBody.trim() || addComment.isPending}
                  >
                    Comment
                  </Button>
                </Box>
              </Stack>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                Activity history
              </Typography>
              {taskActivity.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No activity recorded yet.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {taskActivity.map((entry) => {
                    const actor = userMap.get(entry.actorId);
                    return (
                      <Box key={entry.id}>
                        <Typography variant="body2">
                          <strong>{actor ? fullName(actor) : 'Unknown'}</strong> — {entry.detail}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(entry.createdAt)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack spacing={2.5}>
                <Box>
                  <FieldLabel>Status</FieldLabel>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={task.columnId}
                    disabled={!canEditStatus}
                    onChange={(e) => updateTask.mutate({ taskId: task.id, patch: { columnId: e.target.value } })}
                  >
                    {(board?.columns ?? []).map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <FieldLabel>Assignee</FieldLabel>
                    <ContactButtons user={userMap.get(task.assigneeId)} projectId={task.projectId} taskId={task.id} />
                  </Stack>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={task.assigneeId ?? ''}
                    disabled={!canManage}
                    onChange={(e) => updateTask.mutate({ taskId: task.id, patch: { assigneeId: e.target.value || null } })}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {members.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {fullName(m)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box>
                  <FieldLabel>Creator</FieldLabel>
                  {creator ? <UserIdentity user={creator} /> : <Typography variant="body2">Unknown</Typography>}
                </Box>

                <Box>
                  <FieldLabel>Priority</FieldLabel>
                  {canManage ? (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={task.priority}
                      onChange={(e) => updateTask.mutate({ taskId: task.id, patch: { priority: e.target.value } })}
                    >
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                        <MenuItem key={p} value={p}>
                          {p.charAt(0) + p.slice(1).toLowerCase()}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <PriorityChip priority={task.priority} />
                  )}
                </Box>

                <Box>
                  <FieldLabel>Blocked</FieldLabel>
                  <Chip
                    label={task.blocked ? 'Blocked' : 'Not blocked'}
                    color={task.blocked ? 'error' : 'default'}
                    variant={task.blocked ? 'filled' : 'outlined'}
                    size="small"
                    onClick={canManage ? () => updateTask.mutate({ taskId: task.id, patch: { blocked: !task.blocked } }) : undefined}
                  />
                </Box>

                <Divider />

                <Box>
                  <FieldLabel>Start date</FieldLabel>
                  <Typography variant="body2">{formatDate(task.startDate)}</Typography>
                </Box>
                <Box>
                  <FieldLabel>Due date</FieldLabel>
                  <Typography variant="body2" color={overdue ? 'error.main' : undefined} fontWeight={overdue ? 700 : 400}>
                    {formatDate(task.dueDate)}
                  </Typography>
                </Box>
                <Box>
                  <FieldLabel>Estimated / Actual effort</FieldLabel>
                  <Typography variant="body2">
                    {formatHours(task.estimatedHours)} / {formatHours(task.actualHours)}
                  </Typography>
                </Box>
                <Box>
                  <FieldLabel>Created / Updated</FieldLabel>
                  <Typography variant="body2">
                    {formatDate(task.createdAt)} / {formatDate(task.updatedAt)}
                  </Typography>
                </Box>
                {task.completedAt && (
                  <Box>
                    <FieldLabel>Completed</FieldLabel>
                    <Typography variant="body2">{formatDate(task.completedAt)}</Typography>
                  </Box>
                )}

                {taskLabels.length > 0 && (
                  <Box>
                    <FieldLabel>Labels</FieldLabel>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {taskLabels.map((l) => (
                        <Chip
                          key={l.id}
                          label={l.name}
                          size="small"
                          sx={{ backgroundColor: `${l.color}22`, color: l.color, fontWeight: 700 }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete task"
        description="This will permanently delete this task and its comments. This action cannot be undone."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteTask.mutateAsync(task.id);
          setConfirmDelete(false);
          navigate(project ? `/projects/${project.id}/board` : '/my-tasks');
        }}
      />
      <TaskFormDialog
        open={subtaskDialogOpen}
        onClose={() => setSubtaskDialogOpen(false)}
        projectId={task.projectId}
        columns={board?.columns ?? []}
        defaultColumnId={board?.columns?.[0]?.id ?? ''}
        labels={labels}
        parentTaskId={task.id}
        titlePrefix="Create subtask"
        members={canManage ? members : members.filter((m) => m.id === user?.id)}
      />
      <ConfirmDialog
        open={confirmArchive}
        title={task.archived ? 'Restore task' : 'Archive task'}
        description={
          task.archived
            ? 'This task will be restored to the active board.'
            : 'This task will be moved out of the active board. You can restore it later.'
        }
        confirmLabel={task.archived ? 'Restore' : 'Archive'}
        onClose={() => setConfirmArchive(false)}
        onConfirm={async () => {
          await archiveTask.mutateAsync({ taskId: task.id, archived: !task.archived });
          setConfirmArchive(false);
        }}
      />
    </Box>
  );
}

function FieldLabel({ children }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      fontWeight={700}
      sx={{ display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.4 }}
    >
      {children}
    </Typography>
  );
}

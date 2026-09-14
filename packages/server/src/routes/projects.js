import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

export const projectsRouter = Router();

projectsRouter.use(authMiddleware);

// Helper: verify room membership via project
async function verifyProjectAccess(projectId, userId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  const member = await prisma.roomMember.findFirst({
    where: { roomId: project.roomId, userId, leftAt: null },
  });
  if (!member) return null;
  return project;
}

// Helper: verify the board actually belongs to the (already access-checked) project.
// Prevents an authorized member of project A from operating on a board id
// that belongs to a different project/room by passing A's :id in the URL.
async function verifyBoardInProject(boardId, projectId) {
  return prisma.board.findFirst({ where: { id: boardId, projectId } });
}

// Helper: verify the task actually belongs to the (already access-checked) project.
async function verifyTaskInProject(taskId, projectId) {
  return prisma.task.findFirst({ where: { id: taskId, projectId } });
}

// List projects for a room
projectsRouter.get('/room/:roomId', async (req, res) => {
  try {
    const member = await prisma.roomMember.findFirst({
      where: { roomId: req.params.roomId, userId: req.userId, leftAt: null },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const projects = await prisma.project.findMany({
      where: { roomId: req.params.roomId },
      include: {
        boards: { orderBy: { position: 'asc' } },
        tasks: {
          include: {
            _count: { select: { comments: true } },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Attach assignee names
    const userIds = [...new Set(projects.flatMap((p) => p.tasks.map((t) => t.assigneeId).filter(Boolean)))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const result = projects.map((p) => ({
      ...p,
      tasks: p.tasks.map((t) => ({
        ...t,
        assigneeName: t.assigneeId ? (userMap[t.assigneeId] || null) : null,
      })),
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create project (with default 3 boards)
projectsRouter.post('/', async (req, res) => {
  try {
    const { roomId, name, description } = req.body;
    if (!roomId || !name?.trim()) {
      return res.status(400).json({ error: 'roomId and name required' });
    }

    const member = await prisma.roomMember.findFirst({
      where: { roomId, userId: req.userId, leftAt: null },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const project = await prisma.project.create({
      data: {
        roomId,
        name: name.trim(),
        description: description?.trim() || null,
        createdBy: req.userId,
        boards: {
          create: [
            { name: '할 일', position: 0 },
            { name: '진행 중', position: 1 },
            { name: '완료', position: 2 },
          ],
        },
      },
      include: {
        boards: { orderBy: { position: 'asc' } },
        tasks: true,
      },
    });

    const io = req.app.get('io');
    if (io) io.to(roomId).emit('project_updated', { roomId });

    return res.status(201).json(project);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
projectsRouter.put('/:id', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });

    const { name, description } = req.body;
    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('project_updated', { roomId: project.roomId });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
projectsRouter.delete('/:id', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });

    await prisma.project.delete({ where: { id: req.params.id } });

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('project_updated', { roomId: project.roomId });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Add board to project
projectsRouter.post('/:id/boards', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });

    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });

    const maxPos = await prisma.board.aggregate({
      where: { projectId: req.params.id },
      _max: { position: true },
    });

    const board = await prisma.board.create({
      data: {
        projectId: req.params.id,
        name: name.trim(),
        position: (maxPos._max.position ?? -1) + 1,
      },
    });

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('project_updated', { roomId: project.roomId });

    return res.status(201).json(board);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to add board' });
  }
});

// Update board name
projectsRouter.put('/:id/boards/:boardId', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });
    if (!(await verifyBoardInProject(req.params.boardId, req.params.id))) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });

    const board = await prisma.board.update({
      where: { id: req.params.boardId },
      data: { name: name.trim() },
    });

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('project_updated', { roomId: project.roomId });

    return res.json(board);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update board' });
  }
});

// Delete board
projectsRouter.delete('/:id/boards/:boardId', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });
    if (!(await verifyBoardInProject(req.params.boardId, req.params.id))) {
      return res.status(404).json({ error: 'Board not found' });
    }

    await prisma.board.delete({ where: { id: req.params.boardId } });

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('project_updated', { roomId: project.roomId });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete board' });
  }
});

// Create task
projectsRouter.post('/:id/tasks', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });

    const { boardId, title, description, assigneeId, priority, startDate, dueDate, messageId } = req.body;
    if (!boardId || !title?.trim()) {
      return res.status(400).json({ error: 'boardId and title required' });
    }
    if (!(await verifyBoardInProject(boardId, req.params.id))) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Get max position in the board
    const maxPos = await prisma.task.aggregate({
      where: { boardId },
      _max: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        projectId: req.params.id,
        boardId,
        title: title.trim(),
        description: description?.trim() || null,
        assigneeId: assigneeId || null,
        priority: priority || 'medium',
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        position: (maxPos._max.position ?? -1) + 1,
        createdBy: req.userId,
        messageId: messageId || null,
      },
      include: {
        _count: { select: { comments: true } },
      },
    });

    // Attach assignee name
    let assigneeName = null;
    if (task.assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: task.assigneeId }, select: { name: true } });
      assigneeName = u?.name || null;
    }

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('task_created', { roomId: project.roomId, task: { ...task, assigneeName } });

    return res.status(201).json({ ...task, assigneeName });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
projectsRouter.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });
    if (!(await verifyTaskInProject(req.params.taskId, req.params.id))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, assigneeId, priority, startDate, dueDate } = req.body;
    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
    if (priority !== undefined) data.priority = priority;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

    const task = await prisma.task.update({
      where: { id: req.params.taskId },
      data,
      include: { _count: { select: { comments: true } } },
    });

    let assigneeName = null;
    if (task.assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: task.assigneeId }, select: { name: true } });
      assigneeName = u?.name || null;
    }

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('task_updated', { roomId: project.roomId, task: { ...task, assigneeName } });

    return res.json({ ...task, assigneeName });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
projectsRouter.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });
    if (!(await verifyTaskInProject(req.params.taskId, req.params.id))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({ where: { id: req.params.taskId } });

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('task_deleted', { roomId: project.roomId, taskId: req.params.taskId });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Move task (change board and/or position)
projectsRouter.post('/:id/tasks/:taskId/move', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });
    if (!(await verifyTaskInProject(req.params.taskId, req.params.id))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { boardId, position } = req.body;
    if (!boardId || position === undefined) {
      return res.status(400).json({ error: 'boardId and position required' });
    }
    if (!(await verifyBoardInProject(boardId, req.params.id))) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const task = await prisma.task.update({
      where: { id: req.params.taskId },
      data: { boardId, position },
      include: { _count: { select: { comments: true } } },
    });

    let assigneeName = null;
    if (task.assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: task.assigneeId }, select: { name: true } });
      assigneeName = u?.name || null;
    }

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('task_moved', { roomId: project.roomId, task: { ...task, assigneeName } });

    return res.json({ ...task, assigneeName });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to move task' });
  }
});

// Get task comments
projectsRouter.get('/:id/tasks/:taskId/comments', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });
    if (!(await verifyTaskInProject(req.params.taskId, req.params.id))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId: req.params.taskId },
      orderBy: { createdAt: 'asc' },
    });

    const userIds = [...new Set(comments.map((c) => c.userId))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    return res.json(comments.map((c) => ({ ...c, userName: userMap[c.userId] || 'Unknown' })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add task comment
projectsRouter.post('/:id/tasks/:taskId/comments', async (req, res) => {
  try {
    const project = await verifyProjectAccess(req.params.id, req.userId);
    if (!project) return res.status(403).json({ error: 'Not authorized' });
    if (!(await verifyTaskInProject(req.params.taskId, req.params.id))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content required' });

    const comment = await prisma.taskComment.create({
      data: {
        taskId: req.params.taskId,
        userId: req.userId,
        content: content.trim(),
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });

    const io = req.app.get('io');
    if (io) io.to(project.roomId).emit('task_updated', { roomId: project.roomId });

    return res.status(201).json({ ...comment, userName: user?.name || 'Unknown' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
});

import { get, post } from '@/utils/request'

/* 创建新的对话组 */
export function fetchCreateGroupAPI<T>(data?: {
  appId?: number
  modelConfig?: any
  params?: string
}): Promise<T> {
  return post<T>({
    url: '/group/create',
    data,
  })
}

/* 查询对话组列表 */
export function fetchQueryGroupAPI<T>(): Promise<T> {
  return get<T>({ url: '/group/query' })
}

/* 通过groupId查询当前对话组的详细信息 */
export function fetchGroupInfoById<T>(groupId: number | string): Promise<T> {
  return get<T>({ url: `/group/info/${groupId}` })
}

/* 修改对话组 */
export function fetchUpdateGroupAPI<T>(data?: {
  groupId?: number
  title?: string
  isSticky?: boolean
  config?: string
  fileUrl?: string
  userId?: number
}): Promise<T> {
  return post<T>({
    url: '/group/update',
    data,
  })
}

/* 删除对话组 */
export function fetchDelGroupAPI<T>(data?: { groupId: number }): Promise<T> {
  return post<T>({
    url: '/group/del',
    data,
  })
}

/* 删除全部对话组 */
export function fetchDelAllGroupAPI<T>(data?: { groupId: number }): Promise<T> {
  return post<T>({
    url: '/group/delAll',
    data,
  })
}

/* ==== 群组成员与任务 ==== */
export function fetchGroupAddMemberAPI<T>(data: {
  groupId: number
  userId: number
  name?: string
  role?: string
  order?: number
  appId?: number
  appName?: string
  openingRemark?: string
}): Promise<T> {
  return post<T>({ url: '/group/members/add', data })
}

export function fetchGroupRemoveMemberAPI<T>(data: {
  groupId: number
  userId: number
}): Promise<T> {
  return post<T>({ url: '/group/members/remove', data })
}

export function fetchGroupMembersAPI<T>(data: { groupId: number }): Promise<T> {
  return post<T>({ url: '/group/members/list', data })
}

export function fetchGroupAssignTaskAPI<T>(data: {
  groupId: number
  userId: number
  title: string
  detail?: string
  status?: string
}): Promise<T> {
  return post<T>({ url: '/group/task/assign', data })
}

export function fetchGroupUpdateTaskAPI<T>(data: {
  groupId: number
  userId: number
  taskId: string
  title?: string
  detail?: string
  status?: string
}): Promise<T> {
  return post<T>({ url: '/group/task/update', data })
}

export function fetchGroupUpdateMemberAPI<T>(data: {
  groupId: number
  userId: number
  name?: string
  role?: string
  order?: number
  appId?: number
  appName?: string
  openingRemark?: string
}): Promise<T> {
  return post<T>({ url: '/group/members/update', data })
}

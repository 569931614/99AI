import { get, post } from '@/utils/request'

/* 查询app分组 */
export function fetchQueryAppCatsAPI<T>(): Promise<T> {
  return get<T>({ url: '/app/queryCats' })
}

/*  查询全量app列表 */
export function fetchQueryAppsAPI<T>(): Promise<T> {
  return get<T>({
    url: '/app/list',
  })
}

export function fetchSearchAppsAPI<T>(data: { keyword: string }): Promise<T> {
  return post<T>({
    url: '/app/searchList',
    data,
  })
}

/*  查询个人app列表 */
export function fetchQueryMineAppsAPI<T>(): Promise<T> {
  return get<T>({
    url: '/app/mineApps',
  })
}

/* 收藏app */
export function fetchCollectAppAPI<T>(data: { appId: number }): Promise<T> {
  return post<T>({ url: '/app/collect', data })
}

/* 查询单个分类 */
export function fetchQueryOneCatAPI<T>(data): Promise<T> {
  return get<T>({
    url: '/app/queryOneCat',
    data,
  })
}

/* 获取心理描述开关状态（无鉴权） */
export function fetchGetPsychologicalDescAPI<T>(params: { userId: number; appId: number }): Promise<T> {
  return get<T>({
    url: '/open/app/psychologicalDesc',
    data: params,
  })
}

/* 设置心理描述开关（无鉴权） */
export function fetchSetPsychologicalDescAPI<T>(data: { userId: number; appId: number; enable: boolean }): Promise<T> {
  return post<T>({
    url: '/open/app/psychologicalDesc',
    data,
  })
}

/* ========== 用户创建角色相关接口 ========== */

/* 用户创建自己的角色 */
export function fetchUserCreateRoleAPI<T>(data: any): Promise<T> {
  return post<T>({
    url: '/app/user/createRole',
    data,
  })
}

/* 获取用户自己创建的角色列表 */
export function fetchUserMyRolesAPI<T>(params?: { page?: number; size?: number; name?: string; status?: number }): Promise<T> {
  return get<T>({
    url: '/app/user/myRoles',
    data: params,
  })
}

/* 用户更新自己的角色 */
export function fetchUserUpdateRoleAPI<T>(data: any): Promise<T> {
  return post<T>({
    url: '/app/user/updateRole',
    data,
  })
}

/* 用户删除自己的角色 */
export function fetchUserDelRoleAPI<T>(data: { id: number }): Promise<T> {
  return post<T>({
    url: '/app/user/delRole',
    data,
  })
}

/* 用户切换角色公开状态 */
export function fetchUserTogglePublicRoleAPI<T>(data: { id: number }): Promise<T> {
  return post<T>({
    url: '/app/user/togglePublic',
    data,
  })
}

<script setup lang="ts">
import { fetchQueryAppsAPI } from '@/api/appStore'
import {
  fetchGroupAddMemberAPI,
  fetchGroupAssignTaskAPI,
  fetchGroupMembersAPI,
  fetchGroupRemoveMemberAPI,
  fetchGroupUpdateMemberAPI,
} from '@/api/group'
import { useChatStore, useGlobalStoreWithOut } from '@/store'
import { message } from '@/utils/message'
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface Props {
  title?: string
}

const props = defineProps<Props>()
const ms = message()

const chatStore = useChatStore()
const useGlobalStore = useGlobalStoreWithOut()
const groupList = computed(() => chatStore.groupList)
const activeGroupId = computed(() => chatStore.active)
const activeGroup = computed(() => groupList.value.find(g => g.uuid === activeGroupId.value))

const members = ref<any[]>([])
const loading = ref(false)
const addUserId = ref<number | null>(null)
const addUserName = ref('')
const addUserRole = ref('member')
const addUserOrder = ref<number | null>(null)
const showInlinePicker = ref(false)
const picking = ref(false)
const appOptions = ref<any[]>([])

// 编辑群聊信息
const isEditingGroupInfo = ref(false)
const editGroupTitle = ref('')

function startEditGroupInfo() {
  editGroupTitle.value = activeGroup.value?.title || ''
  isEditingGroupInfo.value = true
}

async function saveGroupInfo() {
  if (!activeGroupId.value || !editGroupTitle.value.trim()) {
    ms.warning('请输入群聊标题')
    return
  }
  try {
    await chatStore.updateGroupInfo({
      groupId: Number(activeGroupId.value),
      title: editGroupTitle.value.trim(),
    })
    await chatStore.queryMyGroup()
    isEditingGroupInfo.value = false
    ms.success('群聊信息已更新')
  } catch (error: any) {
    ms.error(error?.message || '更新失败')
  }
}

function cancelEditGroupInfo() {
  isEditingGroupInfo.value = false
  editGroupTitle.value = ''
}

function openAppList() {
  // 优先使用内嵌选择器，避免抽屉与全局层级冲突
  showInlinePicker.value = true
  if (!appOptions.value.length) loadApps()
}

function onAppPicked(e: any) {
  try {
    const app = e?.detail
    if (!app) return
    // 使用选中的应用作为群聊中的“角色应用”
    addUserId.value = Number(app.id)
    addUserName.value = app.name || ''
    // 记录到成员更新时的应用信息
    // 立即写入（若之后点击添加，会将 appId/appName 一并保存）
  } catch {}
}

async function loadMembers() {
  if (!activeGroupId.value) return
  try {
    loading.value = true
    const res: any = await fetchGroupMembersAPI({ groupId: Number(activeGroupId.value) })
    members.value = Array.isArray(res) ? res : res?.data || []
  } finally {
    loading.value = false
  }
}

async function addMember() {
  if (!activeGroupId.value || addUserId.value == null) {
    ms.warning('请选择要添加的应用')
    return
  }
  try {
    await fetchGroupAddMemberAPI({
      groupId: Number(activeGroupId.value),
      userId: Number(addUserId.value),
      name: addUserName.value || undefined,
      role: addUserRole.value || 'member',
      order: addUserOrder.value == null ? undefined : Number(addUserOrder.value),
      appId: Number(addUserId.value),
      appName: addUserName.value || undefined,
    })
    addUserId.value = null
    addUserName.value = ''
    addUserOrder.value = null
    showInlinePicker.value = false

    await loadMembers()
    await chatStore.queryMyGroup()
    ms.success('成员添加成功')
  } catch (error: any) {
    ms.error(error?.message || '添加失败')
  }
}

async function removeMember(userId: number, memberName: string) {
  if (!confirm(`确定要移除成员 "${memberName}" 吗？`)) return
  try {
    await fetchGroupRemoveMemberAPI({
      groupId: Number(activeGroupId.value),
      userId,
    })
    await loadMembers()
    await chatStore.queryMyGroup()
    ms.success('成员已移除')
  } catch (error: any) {
    ms.error(error?.message || '移除失败')
  }
}

async function assignTask(userId: number) {
  const title = prompt('任务标题') || ''
  if (!title) return
  const detail = prompt('任务描述（可选）') || ''
  await fetchGroupAssignTaskAPI({
    groupId: Number(activeGroupId.value),
    userId: Number(userId),
    title,
    detail,
  })
  await loadMembers()
}

async function updateMember(
  userId: number,
  payload: { role?: string; order?: number; name?: string }
) {
  try {
    await fetchGroupUpdateMemberAPI({ groupId: Number(activeGroupId.value), userId, ...payload })
    await loadMembers()
    ms.success('成员信息已更新')
  } catch (error: any) {
    ms.error(error?.message || '更新失败')
  }
}

onMounted(() => {
  loadMembers()
  window.addEventListener('applist:select', onAppPicked as any)
})

onUnmounted(() => {
  window.removeEventListener('applist:select', onAppPicked as any)
})

async function loadApps() {
  try {
    picking.value = true
    const res: any = await fetchQueryAppsAPI()
    appOptions.value = res?.data?.rows || []
  } finally {
    picking.value = false
  }
}

function pickApp(app: any) {
  addUserId.value = Number(app.id)
  addUserName.value = app.name || ''
  showInlinePicker.value = false
}
</script>

<template>
  <div class="w-full p-4">
    <div class="text-lg font-semibold mb-4">{{ props.title || '群聊管理' }}</div>

    <!-- 群聊信息卡片 -->
    <div
      class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4 bg-gray-50 dark:bg-gray-800"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-medium text-gray-700 dark:text-gray-300">群聊信息</div>
        <button
          v-if="!isEditingGroupInfo"
          class="btn btn-xs btn-primary"
          @click="startEditGroupInfo"
        >
          编辑
        </button>
      </div>

      <div v-if="!isEditingGroupInfo">
        <div class="text-base font-medium mb-1">{{ activeGroup?.title || '新对话' }}</div>
        <div class="text-xs text-gray-500">ID: {{ activeGroupId }}</div>
        <div class="text-xs text-gray-500 mt-1">
          成员数: {{ members.length }} | 群聊状态:
          {{ activeGroup?.isGroupChat ? '✅ 已启用' : '❌ 未启用' }}
        </div>
      </div>

      <div v-else class="space-y-2">
        <input
          v-model="editGroupTitle"
          class="input input-sm w-full"
          type="text"
          placeholder="输入群聊标题"
          @keyup.enter="saveGroupInfo"
        />
        <div class="flex gap-2">
          <button class="btn btn-xs btn-primary" @click="saveGroupInfo">保存</button>
          <button class="btn btn-xs" @click="cancelEditGroupInfo">取消</button>
        </div>
      </div>
    </div>
    <!-- 添加成员区域 -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">添加群聊角色</div>
      <div class="space-y-2">
        <div class="flex items-center gap-2 flex-wrap">
          <select class="select select-sm" v-model="addUserRole">
            <option value="member">群员</option>
            <option value="admin">管理员</option>
          </select>
          <input
            class="input input-sm w-20"
            type="number"
            v-model.number="addUserOrder"
            placeholder="顺序"
          />
          <input
            class="input input-sm flex-1 min-w-[120px]"
            type="text"
            v-model="addUserName"
            placeholder="角色名称"
            readonly
          />
          <button class="btn btn-sm btn-primary" @click="openAppList">选择应用</button>
          <button class="btn btn-sm btn-success" @click="addMember" :disabled="!addUserId">
            添加
          </button>
        </div>

        <div
          v-if="showInlinePicker"
          class="mt-2 rounded border border-gray-300 dark:border-gray-600 p-3 max-h-60 overflow-auto bg-white dark:bg-gray-900"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-medium">选择应用作为群聊角色</div>
            <button class="btn btn-xs" @click="showInlinePicker = false">关闭</button>
          </div>
          <div v-if="picking" class="text-sm text-gray-500">加载应用中…</div>
          <ul v-else class="space-y-1">
            <li
              v-for="app in appOptions"
              :key="app.id"
              class="cursor-pointer px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-800 rounded transition-colors"
              :class="{ 'bg-blue-100 dark:bg-gray-700': addUserId === app.id }"
              @click="pickApp(app)"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{{ app.name }}</span>
                <span class="text-xs text-gray-500">#{{ app.id }}</span>
              </div>
              <div v-if="app.des" class="text-xs text-gray-500 mt-1">{{ app.des }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 成员列表 -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">群聊成员列表</div>
      <div v-if="loading" class="text-sm text-gray-500 text-center py-4">加载中...</div>
      <div v-else-if="!members.length" class="text-sm text-gray-500 text-center py-4">
        暂无成员，请添加应用作为群聊角色
      </div>
      <ul v-else class="space-y-3">
        <li
          v-for="(m, index) in members"
          :key="m.userId"
          class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium">{{
                  m.name || m.appName || '成员' + m.userId
                }}</span>
                <span
                  class="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                >
                  {{ m.role === 'admin' ? '管理员' : '群员' }}
                </span>
                <span class="text-xs text-gray-500">顺序: {{ m.order || index + 1 }}</span>
              </div>
              <div class="text-xs text-gray-500">
                ID: #{{ m.userId }}
                <span v-if="m.appName"> · 应用: {{ m.appName }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button
                class="btn btn-xs btn-error"
                @click="removeMember(m.userId, m.name || m.appName || '成员' + m.userId)"
              >
                删除
              </button>
            </div>
          </div>

          <!-- 成员编辑区域 -->
          <div
            class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-wrap"
          >
            <select
              class="select select-xs"
              :value="m.role || 'member'"
              @change="e => updateMember(m.userId, { role: (e.target as HTMLSelectElement).value })"
            >
              <option value="member">群员</option>
              <option value="admin">管理员</option>
            </select>
            <input
              class="input input-xs w-20"
              type="number"
              :value="m.order || ''"
              placeholder="顺序"
              @change="
                e => updateMember(m.userId, { order: Number((e.target as HTMLInputElement).value) })
              "
            />
            <button class="btn btn-xs" @click="assignTask(m.userId)">分配任务</button>
          </div>

          <!-- 任务列表 -->
          <div
            v-if="m.tasks && m.tasks.length"
            class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700"
          >
            <div class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">任务列表</div>
            <ul class="space-y-1">
              <li
                v-for="t in m.tasks"
                :key="t.taskId"
                class="text-xs text-gray-600 dark:text-gray-400 pl-2 border-l-2 border-blue-400"
              >
                {{ t.title }}
                <span class="text-gray-500">({{ t.status || 'todo' }})</span>
              </li>
            </ul>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped></style>

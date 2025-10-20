<template>
  <div class="h-full flex flex-col p-4 overflow-hidden">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">我的角色</h3>
      <button
        @click="showCreateDialog = true"
        class="btn btn-primary btn-sm flex items-center gap-2"
      >
        <Plus size="16" />
        创建角色
      </button>
    </div>

    <!-- 角色列表 -->
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div v-if="loading" class="flex justify-center items-center h-32">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>

      <div v-else-if="roles.length === 0" class="text-center py-12">
        <p class="text-gray-500 dark:text-gray-400 mb-4">还没有创建任何角色</p>
        <button
          @click="showCreateDialog = true"
          class="btn btn-primary btn-sm"
        >
          创建第一个角色
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="role in roles"
          :key="role.id"
          class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
        >
          <div class="flex items-start gap-3">
            <img
              v-if="role.coverImg"
              :src="role.coverImg"
              class="w-12 h-12 rounded-full object-cover flex-shrink-0"
              alt="role cover"
            />
            <div
              v-else
              class="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold flex-shrink-0"
            >
              {{ role.name.substring(0, 1) }}
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <h4 class="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {{ role.name }}
                </h4>
                <div class="flex items-center gap-1">
                  <button
                    @click="togglePublic(role)"
                    class="btn-icon btn-xs"
                    :title="role.public ? '公开' : '私有'"
                  >
                    <component
                      :is="role.public ? Unlock : Lock"
                      size="14"
                      :class="role.public ? 'text-green-600' : 'text-gray-400'"
                    />
                  </button>
                  <button
                    @click="editRole(role)"
                    class="btn-icon btn-xs"
                    title="编辑"
                  >
                    <Edit size="14" />
                  </button>
                  <button
                    @click="deleteRole(role)"
                    class="btn-icon btn-xs text-red-500 hover:text-red-600"
                    title="删除"
                  >
                    <Delete size="14" />
                  </button>
                </div>
              </div>

              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                {{ role.des || '暂无描述' }}
              </p>

              <div class="flex items-center gap-2 text-xs text-gray-500">
                <span v-if="role.catName" class="truncate">{{ role.catName }}</span>
                <span v-if="role.public" class="text-green-600">• 公开</span>
                <span v-else class="text-gray-400">• 私有</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建/编辑角色弹窗 -->
    <transition name="modal-fade">
      <div
        v-if="showCreateDialog || showEditDialog"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50"
        @click.self="closeDialog"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        >
          <div class="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {{ showEditDialog ? '编辑角色' : '创建角色' }}
              </h3>
              <button @click="closeDialog" class="btn-icon btn-sm">
                <Close size="20" />
              </button>
            </div>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                角色名称 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formData.name"
                type="text"
                class="input input-md w-full"
                placeholder="请输入角色名称"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                分类 <span class="text-red-500">*</span>
              </label>
              <select v-model="formData.catId" class="input input-md w-full">
                <option value="">请选择分类</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id.toString()">
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                角色描述
              </label>
              <textarea
                v-model="formData.des"
                rows="3"
                class="input input-md w-full"
                placeholder="请输入角色描述"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                角色设定
              </label>
              <textarea
                v-model="formData.preset"
                rows="5"
                class="input input-md w-full"
                placeholder="请输入角色设定..."
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                封面图片URL
              </label>
              <input
                v-model="formData.coverImg"
                type="text"
                class="input input-md w-full"
                placeholder="请输入封面图片URL"
              />
            </div>
          </div>

          <div class="sticky bottom-0 bg-gray-50 dark:bg-gray-750 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button @click="closeDialog" class="btn btn-default btn-md">
              取消
            </button>
            <button
              @click="submitForm"
              :disabled="!formData.name || !formData.catId || submitting"
              class="btn btn-primary btn-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="submitting" class="inline-block mr-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block"></div>
              </span>
              {{ showEditDialog ? '保存' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import {
  fetchQueryAppCatsAPI,
  fetchUserCreateRoleAPI,
  fetchUserDelRoleAPI,
  fetchUserMyRolesAPI,
  fetchUserTogglePublicRoleAPI,
  fetchUserUpdateRoleAPI,
} from '@/api/appStore'
import type { ResData } from '@/api/types'
import { dialog } from '@/utils/dialog'
import { message } from '@/utils/message'
import { Close, Delete, Edit, Lock, Plus, Unlock } from '@icon-park/vue-next'
import { onMounted, ref } from 'vue'

interface Role {
  id: number
  name: string
  des: string
  preset: string
  coverImg: string
  catId: string
  catName?: string
  public: boolean
  status: number
}

interface Category {
  id: number
  name: string
}

const ms = message()
const dialogInstance = dialog()

const loading = ref(false)
const roles = ref<Role[]>([])
const categories = ref<Category[]>([])

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const submitting = ref(false)

const formData = ref({
  id: 0,
  name: '',
  catId: '',
  des: '',
  preset: '',
  coverImg: '',
})

// 加载角色列表
async function loadRoles() {
  loading.value = true
  try {
    const res: ResData = await fetchUserMyRolesAPI()
    if (res.success) {
      roles.value = res.data.rows || []
    }
  } catch (error: any) {
    ms.error(error.message || '加载角色列表失败')
  } finally {
    loading.value = false
  }
}

// 加载分类列表
async function loadCategories() {
  try {
    const res: ResData = await fetchQueryAppCatsAPI()
    if (res.success) {
      categories.value = res.data.rows || []
    }
  } catch (error: any) {
    console.error('加载分类失败:', error)
  }
}

// 切换公开状态
async function togglePublic(role: Role) {
  try {
    const res: ResData = await fetchUserTogglePublicRoleAPI({ id: role.id })
    if (res.success) {
      role.public = res.data.public
      ms.success(role.public ? '已设为公开' : '已设为私有')
    }
  } catch (error: any) {
    ms.error(error.message || '操作失败')
  }
}

// 编辑角色
function editRole(role: Role) {
  formData.value = {
    id: role.id,
    name: role.name,
    catId: role.catId,
    des: role.des || '',
    preset: role.preset || '',
    coverImg: role.coverImg || '',
  }
  showEditDialog.value = true
}

// 删除角色
function deleteRole(role: Role) {
  dialogInstance.warning({
    title: '删除角色',
    content: `确定要删除角色"${role.name}"吗？此操作不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const res: ResData = await fetchUserDelRoleAPI({ id: role.id })
        if (res.success) {
          ms.success('删除成功')
          await loadRoles()
        }
      } catch (error: any) {
        ms.error(error.message || '删除失败')
      }
    },
  })
}

// 提交表单
async function submitForm() {
  if (!formData.value.name || !formData.value.catId) {
    ms.warning('请填写必填项')
    return
  }

  submitting.value = true
  try {
    const data = { ...formData.value }
    let res: ResData

    if (showEditDialog.value) {
      res = await fetchUserUpdateRoleAPI(data)
    } else {
      delete data.id
      res = await fetchUserCreateRoleAPI(data)
    }

    if (res.success) {
      ms.success(showEditDialog.value ? '更新成功' : '创建成功')
      closeDialog()
      await loadRoles()
    }
  } catch (error: any) {
    ms.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

// 关闭对话框
function closeDialog() {
  showCreateDialog.value = false
  showEditDialog.value = false
  formData.value = {
    id: 0,
    name: '',
    catId: '',
    des: '',
    preset: '',
    coverImg: '',
  }
}

onMounted(() => {
  loadRoles()
  loadCategories()
})
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>

<script setup lang="ts">
  import api from '@/api/modules/affection';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import { onMounted, reactive, ref } from 'vue';

  interface Rule {
    id?: number;
    appId?: number | null;
    stageName: string;
    minScore: number;
    maxScore?: number | null;
    behaviors: string;
  }

  const loading = ref(false);
  const rules = ref<Rule[]>([]);
  const filter = reactive<{ appId?: number }>({});

  async function fetchRules() {
    loading.value = true;
    try {
      const res = (await api.listRules({ appId: filter.appId ?? undefined })) as any;
      // 后端响应结构为 { code, data, success, message }，这里取 res.data 作为表格数据
      rules.value = Array.isArray(res?.data) ? (res.data as Rule[]) : [];
    } finally {
      loading.value = false;
    }
  }

  function addRow() {
    rules.value.push({ stageName: '', minScore: 0, maxScore: null, behaviors: '' });
  }

  async function saveRow(row: Rule) {
    if (!row.stageName) return ElMessage.error('请填写阶段名称');
    if (row.minScore == null) return ElMessage.error('请填写最小分数');
    const payload: Rule = { ...row, appId: filter.appId ?? null } as any;
    await api.upsertRule(payload);
    ElMessage.success('已保存');
    await fetchRules();
  }

  async function removeRow(row: Rule, idx: number) {
    if (!row.id) {
      rules.value.splice(idx, 1);
      return;
    }
    await ElMessageBox.confirm('确定删除该规则吗？', '提示');
    await api.removeRule(row.id);
    ElMessage.success('已删除');
    await fetchRules();
  }

  onMounted(fetchRules);
</script>

<template>
  <div class="p-4">
    <div class="mb-4 flex items-center gap-3">
      <el-select
        v-model="filter.appId"
        clearable
        placeholder="按应用ID筛选（清空=全局规则）"
        style="width: 280px"
        @change="fetchRules"
      />
      <el-button type="primary" @click="addRow">新增规则</el-button>
      <el-button @click="fetchRules">刷新</el-button>
    </div>

    <el-table :data="rules" v-loading="loading" border style="width: 100%">
      <el-table-column label="阶段名称" width="140">
        <template #default="{ row }">
          <el-input v-model="row.stageName" placeholder="如：初见/暧昧/恋人" />
        </template>
      </el-table-column>
      <el-table-column label="分数下限" width="120">
        <template #default="{ row }">
          <el-input-number v-model="row.minScore" :min="0" />
        </template>
      </el-table-column>
      <el-table-column label="分数上限(空=无上限)" width="180">
        <template #default="{ row }">
          <el-input-number v-model="row.maxScore" :min="0" :controls="true" />
        </template>
      </el-table-column>
      <el-table-column label="行为规范">
        <template #default="{ row }">
          <el-input v-model="row.behaviors" type="textarea" :rows="4" placeholder="多条可换行" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row, $index }">
          <el-button type="primary" link @click="saveRow(row)">保存</el-button>
          <el-button type="danger" link @click="removeRow(row, $index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="mt-3 text-xs text-gray-500">
      提示：
      <ul>
        <li>同一应用（AppId）下的规则优先于全局规则；分数区间建议避免重叠。</li>
        <li>空的上限表示“及以上”。</li>
      </ul>
    </div>
  </div>
</template>

<style scoped></style>

<!-- 优化后的角色编辑弹窗模板 -->
<template>
  <el-dialog
    v-model="visible"
    :close-on-click-modal="false"
    :title="dialogTitle"
    width="90%"
    top="3vh"
    @close="handlerCloseDialog(formPackageRef)"
    class="app-dialog-optimized"
  >
    <el-form
      ref="formPackageRef"
      label-position="right"
      label-width="110px"
      :model="formPackage"
      :rules="rules"
    >
      <el-tabs type="border-card" class="form-tabs-optimized">
        <!-- 基础信息 -->
        <el-tab-pane>
          <template #label>
            <span class="tab-label">
              <el-icon><Avatar /></el-icon>
              基础信息
            </span>
          </template>

          <div class="tab-content">
            <el-card shadow="never" class="form-card">
              <template #header>
                <div class="card-header">
                  <el-icon><Edit /></el-icon>
                  <span>基本设置</span>
                </div>
              </template>

              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="角色名称" prop="name">
                    <el-input
                      v-model="formPackage.name"
                      placeholder="请输入角色名称"
                      clearable
                      size="large"
                    >
                      <template #prefix>
                        <el-icon><User /></el-icon>
                      </template>
                    </el-input>
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="角色头像" prop="coverImg">
                    <div class="avatar-upload-box">
                      <el-input
                        v-model="formPackage.coverImg"
                        placeholder="填写图片URL或上传"
                        clearable
                        size="large"
                      >
                        <template #prefix>
                          <el-icon><Picture /></el-icon>
                        </template>
                      </el-input>
                      <el-upload
                        class="avatar-uploader-inline"
                        :http-request="customUpload"
                        :show-file-list="false"
                        :on-success="handleAvatarSuccess"
                        :before-upload="beforeAvatarUpload"
                      >
                        <el-button type="primary" size="large" style="margin-left: 10px;">
                          <el-icon><Upload /></el-icon>
                          上传
                        </el-button>
                      </el-upload>
                      <el-avatar
                        v-if="formPackage.coverImg"
                        :src="formPackage.coverImg"
                        :size="50"
                        style="margin-left: 10px;"
                      />
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="20">
                <el-col :span="24">
                  <el-form-item label="角色设定" prop="preset">
                    <el-input
                      v-model="formPackage.preset"
                      type="textarea"
                      placeholder="请详细描述角色的性格、背景、说话风格等..."
                      :rows="6"
                      maxlength="2000"
                      show-word-limit
                    />
                    <div class="form-item-tip">
                      <el-icon><InfoFilled /></el-icon>
                      角色设定会影响AI的回答风格和语气，建议详细描述
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="20" v-if="false">
                <el-col :span="12">
                  <el-form-item label="固定模型">
                    <el-switch
                      v-model="formPackage.isFixedModel"
                      :active-value="1"
                      :inactive-value="0"
                      active-text="开启"
                      inactive-text="关闭"
                    />
                    <div class="form-item-tip" v-if="formPackage.isFixedModel === 1">
                      <el-icon><Warning /></el-icon>
                      开启后，此角色将固定使用指定模型
                    </div>
                  </el-form-item>
                </el-col>

                <el-col :span="12" v-if="formPackage.isFixedModel === 1">
                  <el-form-item label="使用模型" prop="appModel">
                    <el-select
                      v-model="formPackage.appModel"
                      filterable
                      allow-create
                      placeholder="选择或输入模型名称"
                      clearable
                      size="large"
                      style="width: 100%"
                    >
                      <el-option
                        v-for="item in modelOptions"
                        :key="item"
                        :label="item"
                        :value="item"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
            </el-card>
          </div>
        </el-tab-pane>

        <!-- 语音配置 -->
        <el-tab-pane>
          <template #label>
            <span class="tab-label">
              <el-icon><Headset /></el-icon>
              语音配置
            </span>
          </template>

          <div class="tab-content">
            <el-card shadow="never" class="form-card">
              <template #header>
                <div class="card-header">
                  <el-icon><Microphone /></el-icon>
                  <span>默认音色</span>
                </div>
              </template>

              <el-row :gutter="20">
                <el-col :span="24">
                  <el-form-item label="角色音色" prop="voiceId">
                    <el-select
                      v-model="formPackage.voiceId"
                      filterable
                      clearable
                      :loading="voiceLoading"
                      placeholder="选择角色的默认音色"
                      size="large"
                      style="width: 100%"
                    >
                      <el-option
                        v-for="opt in voiceOptions"
                        :key="opt.value"
                        :label="opt.label"
                        :value="opt.value"
                      >
                        <span style="float: left">{{ opt.label }}</span>
                        <span style="float: right; color: #8492a6; font-size: 13px">
                          {{ opt.value }}
                        </span>
                      </el-option>
                    </el-select>
                    <div class="form-item-tip">
                      <el-icon><InfoFilled /></el-icon>
                      设置角色的默认语音，不同音色会影响角色的声音特点
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>
            </el-card>

            <el-card shadow="never" class="form-card" style="margin-top: 20px;">
              <template #header>
                <div class="card-header">
                  <el-icon><Operation /></el-icon>
                  <span>情绪音色映射</span>
                </div>
              </template>

              <el-table
                :data="roleEmotion.list"
                border
                size="default"
                style="width: 100%"
                :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
              >
                <el-table-column label="情绪类型" prop="emotion" width="200" align="center">
                  <template #default="scope">
                    <el-tag type="info" effect="plain">{{ scope.row.emotion }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="对应音色">
                  <template #default="scope">
                    <el-select
                      v-model="scope.row.voiceId"
                      filterable
                      clearable
                      :loading="voiceLoading"
                      placeholder="选择该情绪对应的音色"
                      size="default"
                      style="width: 100%"
                    >
                      <el-option
                        v-for="opt in voiceOptions"
                        :key="opt.value"
                        :label="opt.label"
                        :value="opt.value"
                      />
                    </el-select>
                  </template>
                </el-table-column>
              </el-table>
              <div class="form-item-tip" style="margin-top: 10px;">
                <el-icon><InfoFilled /></el-icon>
                根据不同情绪自动切换音色，让角色表达更生动
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <!-- 星尘API配置 -->
        <el-tab-pane>
          <template #label>
            <span class="tab-label">
              <el-icon><Setting /></el-icon>
              星尘API配置
            </span>
          </template>

          <div class="tab-content">
            <el-card shadow="never" class="form-card">
              <template #header>
                <div class="card-header">
                  <el-icon><ChatDotRound /></el-icon>
                  <span>对话增强</span>
                </div>
              </template>

              <el-row :gutter="20">
                <el-col :span="24">
                  <el-form-item label="开场白" prop="openingRemark">
                    <el-input
                      v-model="formPackage.openingRemark"
                      type="textarea"
                      placeholder="例如：你好！我是你的AI助手，有什么可以帮助你的吗？"
                      :rows="3"
                      maxlength="500"
                      show-word-limit
                    />
                    <div class="form-item-tip">
                      <el-icon><InfoFilled /></el-icon>
                      角色在新对话开始时的问候语
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="20">
                <el-col :span="8">
                  <el-form-item label="真实时间">
                    <el-switch
                      v-model="formPackage.enableRealTime"
                      active-text="开启"
                      inactive-text="关闭"
                      size="large"
                    />
                    <div class="form-item-tip">
                      <el-icon><Clock /></el-icon>
                      AI可以感知当前时间
                    </div>
                  </el-form-item>
                </el-col>

                <el-col :span="8">
                  <el-form-item label="长期记忆">
                    <el-switch
                      v-model="formPackage.enableLongTermMemory"
                      active-text="开启"
                      inactive-text="关闭"
                      size="large"
                    />
                    <div class="form-item-tip">
                      <el-icon><Memo /></el-icon>
                      记住用户的偏好和历史
                    </div>
                  </el-form-item>
                </el-col>

                <el-col :span="8">
                  <el-form-item label="知识库搜索">
                    <el-switch
                      v-model="formPackage.enableKnowledgeBase"
                      active-text="开启"
                      inactive-text="关闭"
                      size="large"
                    />
                    <div class="form-item-tip">
                      <el-icon><Search /></el-icon>
                      从知识库检索信息
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>
            </el-card>

            <el-card
              shadow="never"
              class="form-card"
              style="margin-top: 20px;"
              v-if="formPackage.enableKnowledgeBase"
            >
              <template #header>
                <div class="card-header">
                  <el-icon><FolderOpened /></el-icon>
                  <span>知识库配置</span>
                </div>
              </template>

              <el-row :gutter="20">
                <el-col :span="24">
                  <el-form-item label="知识库ID" prop="knowledgeBaseIds">
                    <el-input
                      v-model="formPackage.knowledgeBaseIds"
                      type="textarea"
                      placeholder="每行输入一个知识库ID，例如：&#10;kb_id_1&#10;kb_id_2"
                      :rows="4"
                    />
                    <div class="form-item-tip">
                      <el-icon><InfoFilled /></el-icon>
                      每行一个知识库ID，AI会从这些知识库中检索相关信息
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>
            </el-card>

            <el-card shadow="never" class="form-card" style="margin-top: 20px;">
              <template #header>
                <div class="card-header">
                  <el-icon><ChatLineRound /></el-icon>
                  <span>对话示例</span>
                </div>
              </template>

              <div style="margin-bottom: 15px;">
                <el-button type="primary" size="default" @click="addDialogueExample">
                  <el-icon><Plus /></el-icon>
                  新增对话示例
                </el-button>
                <span class="form-item-tip" style="margin-left: 15px;">
                  <el-icon><InfoFilled /></el-icon>
                  提供2-4组对话示例，帮助AI理解你期望的回答风格
                </span>
              </div>

              <el-table
                :data="dialogueExamplesList"
                border
                size="default"
                style="width: 100%"
                :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
                v-if="dialogueExamplesList.length > 0"
              >
                <el-table-column label="角色" width="150" align="center">
                  <template #default="scope">
                    <el-select
                      v-model="scope.row.role"
                      placeholder="选择角色"
                      size="default"
                      style="width: 100%"
                    >
                      <el-option label="👤 用户" value="user" />
                      <el-option label="🤖 AI助手" value="assistant" />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column label="对话内容">
                  <template #default="scope">
                    <el-input
                      v-model="scope.row.content"
                      type="textarea"
                      :rows="2"
                      placeholder="请输入对话内容..."
                    />
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100" align="center">
                  <template #default="scope">
                    <el-button
                      link
                      type="danger"
                      @click="removeDialogueExample(scope.$index)"
                      size="default"
                    >
                      <el-icon><Delete /></el-icon>
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>

              <el-empty
                v-else
                description="暂无对话示例，点击上方按钮添加"
                :image-size="100"
              />
            </el-card>
          </div>
        </el-tab-pane>

        <!-- 高级配置 -->
        <el-tab-pane v-if="false">
          <template #label>
            <span class="tab-label">
              <el-icon><Tools /></el-icon>
              高级配置
            </span>
          </template>

          <div class="tab-content">
            <el-card shadow="never" class="form-card">
              <template #header>
                <div class="card-header">
                  <el-icon><Document /></el-icon>
                  <span>提问模板</span>
                </div>
              </template>

              <!-- 提问模板相关内容 -->
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false" size="large">
          <el-icon><Close /></el-icon>
          取消
        </el-button>
        <el-button type="primary" @click="handlerSubmit(formPackageRef)" size="large">
          <el-icon><Check /></el-icon>
          {{ dialogButton }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.app-dialog-optimized {
  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.form-tabs-optimized {
  border: none;
  box-shadow: none;

  :deep(.el-tabs__header) {
    margin: 0;
    background: #f5f7fa;
  }

  :deep(.el-tabs__content) {
    padding: 0;
  }
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.tab-content {
  padding: 24px;
  min-height: 400px;
  max-height: 65vh;
  overflow-y: auto;
}

.form-card {
  margin-bottom: 20px;
  border-radius: 8px;

  :deep(.el-card__header) {
    padding: 16px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-bottom: none;
  }

  :deep(.el-card__body) {
    padding: 24px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
}

.form-item-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: #f0f9ff;
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
  font-size: 13px;
  color: #64748b;
}

.avatar-upload-box {
  display: flex;
  align-items: center;
  width: 100%;
}

.avatar-uploader-inline {
  display: inline-block;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
}

/* 自定义滚动条 */
.tab-content::-webkit-scrollbar {
  width: 8px;
}

.tab-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.tab-content::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>

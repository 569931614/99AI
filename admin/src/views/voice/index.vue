<template>
  <div class="p-4">
    <el-card class="mb-4" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>声音复刻（创建音色）</span>
          <div class="flex gap-2">
            <el-button type="success" @click="syncPendingStatus" :loading="syncing" size="small">
              同步PENDING状态
            </el-button>
            <el-button
              type="primary"
              @click="openCreateVoice()"
              :loading="loading || syncing"
              size="small"
            >
              创建音色
            </el-button>
            <el-button size="small" @click="onRefresh" :loading="loading || syncing"
              >刷新列表</el-button
            >
          </div>
        </div>
      </template>
      <div class="text-xs text-gray-500 leading-6">
        可选择 DashScope API 训练、GPT-SoVITS 模型导入 或 MiniMax 语音克隆，点击"创建音色"进行配置。
      </div>
    </el-card>
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>声音列表</span>
          <div class="flex gap-2 items-center">
            <span class="text-xs text-gray-500">分类数量: {{ categories.length }}</span>
            <el-button type="primary" @click="openCategoryManage" size="small">
              分类管理
            </el-button>
          </div>
        </div>
      </template>
      <div class="mb-3 flex items-center gap-2">
        <el-input
          v-model="listQuery.name"
          placeholder="按名称搜索"
          clearable
          style="width: 200px"
        />
        <el-input v-model="listQuery.prefix" placeholder="按前缀过滤" style="width: 200px" />
        <el-select
          v-model="listQuery.categoryId"
          placeholder="按分类过滤"
          clearable
          style="width: 160px"
        >
          <el-option label="全部" value="" />
          <el-option label="未分类" :value="0" />
          <template v-for="cat in categories" :key="cat?.id">
            <el-option v-if="cat && cat.id" :label="cat.name" :value="cat.id" />
          </template>
        </el-select>
        <el-button @click="onSearch">查询</el-button>
      </div>
      <el-table :data="voices" v-loading="loading" size="small" style="width: 100%">
        <el-table-column label="名称" width="160">
          <template #default="scope">
            <span>{{ scope.row.name || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="160">
          <template #default="scope">
            <el-select
              v-model="scope.row.categoryId"
              placeholder="选择分类"
              size="small"
              clearable
              @change="onCategoryChange(scope.row)"
              style="width: 140px"
            >
              <el-option label="未分类" :value="0" />
              <template v-for="cat in categories" :key="cat?.id">
                <el-option v-if="cat && cat.id" :label="cat.name" :value="cat.id" />
              </template>
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="voice_id" label="Voice ID" min-width="260" />

        <el-table-column prop="status" label="状态" width="120">
          <template #default="scope">
            <el-tag
              :type="
                scope.row.status === 'SUCCEEDED'
                  ? 'success'
                  : scope.row.status === 'FAILED'
                    ? 'danger'
                    : 'warning'
              "
            >
              {{ scope.row.status || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="600">
          <template #default="scope">
            <el-button size="small" @click="onQuery(scope.row)">查询训练状态</el-button>
            <el-button
              size="small"
              type="primary"
              @click="openPreview(scope.row)"
              :disabled="scope.row.status !== 'SUCCEEDED'"
              >试听</el-button
            >
            <el-button
              size="small"
              type="warning"
              @click="goToTestPage(scope.row)"
              :disabled="scope.row.status !== 'SUCCEEDED'"
            >
              参数调节
            </el-button>
            <el-button size="small" type="success" class="ml-2" @click="openSetParams(scope.row)"
              >设置参数</el-button
            >
            <el-button size="small" class="ml-2" @click="openSetName(scope.row)"
              >设置名称</el-button
            >
            <el-popconfirm title="确认删除该音色？" @confirm="onRemove(scope.row)">
              <template #reference>
                <el-button size="small" type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-3 flex items-center justify-end">
        <el-pagination
          :current-page="uiPage"
          :page-size="listQuery.page_size"
          :page-sizes="[10, 20, 50, 100]"
          :total="computedTotal"
          layout="prev, pager, next, sizes"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="createVoiceDialog.visible" title="创建音色" width="900px">
      <el-tabs v-model="createVoiceDialog.active">
        <el-tab-pane label="DashScope API 训练" name="api">
          <el-form :model="enrollForm" label-width="100px" class="space-y-4">
            <el-form-item label="名称">
              <el-input v-model="enrollForm.name" placeholder="给该音色起个名字（便于识别）" />
            </el-form-item>
            <el-form-item label="前缀">
              <el-input v-model="enrollForm.prefix" placeholder="用于区分的前缀，如 myvoice" />
            </el-form-item>
            <el-form-item label="样本音频">
              <div class="flex items-center gap-3">
                <el-upload :show-file-list="false" :http-request="customUpload">
                  <el-button>上传音频文件</el-button>
                </el-upload>
                <span v-if="enrollForm.url" class="text-gray-500 text-sm">已上传</span>
              </div>
              <template #extra>
                <div class="text-xs text-gray-500 leading-5">
                  要求：10-20秒、≥16kHz、WAV/MP3/M4A，≤10MB。
                </div>
              </template>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="GPT-SoVITS 模型导入" name="gpt">
          <el-form :model="gptSovitsForm" label-width="120px" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <el-form-item label="名称">
                <el-input v-model="gptSovitsForm.name" placeholder="展示名称（可选）" />
              </el-form-item>
              <el-form-item label="Voice ID">
                <el-input v-model="gptSovitsForm.voiceId" placeholder="可选，不填自动生成" />
              </el-form-item>
            </div>
            <el-divider content-position="left">🎭 使用角色（推荐）</el-divider>
            <el-form-item label="选择角色">
              <el-select
                v-model="gptSovitsForm.characterName"
                placeholder="选择预置角色（自动加载模型）"
                filterable
                clearable
                style="width: 100%"
                :loading="charactersLoading"
              >
                <el-option v-for="char in characters" :key="char" :label="char" :value="char" />
              </el-select>
              <template #extra>
                <div class="text-xs text-gray-500 mt-1">
                  选择角色后，系统会自动加载对应的GPT和SoVITS模型，无需手动选择模型文件
                  <el-button
                    type="text"
                    size="small"
                    @click="fetchCharacters"
                    :loading="charactersLoading"
                  >
                    刷新角色列表
                  </el-button>
                </div>
              </template>
            </el-form-item>
            <el-divider content-position="left">📁 或手动选择模型文件</el-divider>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <el-form-item label="GPT 模型">
                <el-select
                  v-model="gptSovitsForm.gptModelPath"
                  placeholder="选择模型文件"
                  filterable
                  style="width: 100%"
                >
                  <el-option
                    v-for="entry in gptLibraryOptions"
                    :key="entry.path"
                    :label="formatLibraryLabel(entry)"
                    :value="entry.path"
                    :title="entry.path"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="SoVITS 模型">
                <el-select
                  v-model="gptSovitsForm.sovitsModelPath"
                  placeholder="选择模型文件"
                  filterable
                  style="width: 100%"
                >
                  <el-option
                    v-for="entry in sovitsLibraryOptions"
                    :key="entry.path"
                    :label="formatLibraryLabel(entry)"
                    :value="entry.path"
                    :title="entry.path"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="Prompt 音频">
                <div class="flex flex-col gap-2 w-full">
                  <el-upload
                    :auto-upload="false"
                    :show-file-list="false"
                    accept=".wav,.mp3,.m4a,.flac,.ogg"
                    @change="onPromptAudioFileChange"
                  >
                    <el-button>{{
                      gptSovitsForm.promptAudioFile ? '重新选择音频' : '上传音频文件'
                    }}</el-button>
                  </el-upload>
                  <div
                    v-if="gptSovitsForm.promptAudioFileName"
                    class="text-xs text-gray-500 flex items-center gap-2"
                  >
                    <span>
                      {{ gptSovitsForm.promptAudioFileName }}
                      <template v-if="gptSovitsForm.promptAudioFileSize">
                        （{{ formatFileSize(gptSovitsForm.promptAudioFileSize) }}）
                      </template>
                    </span>
                    <el-button link type="danger" @click="clearPromptAudioFile">清除</el-button>
                  </div>
                </div>
              </el-form-item>
            </div>
            <el-form-item label="Prompt 文本">
              <el-input
                type="textarea"
                v-model="gptSovitsForm.promptText"
                placeholder="训练时的参考文本（必填）"
                :rows="2"
              />
            </el-form-item>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <el-form-item label="Prompt 语言">
                <el-select v-model="gptSovitsForm.promptLanguage">
                  <el-option
                    v-for="lang in gptSovitsLanguages"
                    :key="lang"
                    :label="lang"
                    :value="lang"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="输出语言">
                <el-select v-model="gptSovitsForm.textLanguage">
                  <el-option
                    v-for="lang in gptSovitsLanguages"
                    :key="lang"
                    :label="lang"
                    :value="lang"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="文本分割方式">
                <el-select v-model="gptSovitsForm.cutPunc" placeholder="选择分割方式">
                  <el-option label="cut0 - 不分割（推荐）" value="cut0" />
                  <el-option label="cut1 - 每4句分割" value="cut1" />
                  <el-option label="cut2 - 每50字分割" value="cut2" />
                  <el-option label="cut3 - 按句号分割" value="cut3" />
                  <el-option label="cut4 - 按英文句号分割" value="cut4" />
                  <el-option label="cut5 - 按所有标点分割（易截断）" value="cut5" />
                </el-select>
              </el-form-item>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <el-form-item label="采样率">
                <el-input-number
                  v-model="gptSovitsForm.sampleRate"
                  :min="16000"
                  :max="48000"
                  :step="1000"
                />
              </el-form-item>
              <el-form-item label="Top K">
                <el-input-number v-model="gptSovitsForm.topK" :min="0" :step="1" />
              </el-form-item>
              <el-form-item label="Top P">
                <el-input-number v-model="gptSovitsForm.topP" :min="0" :max="1" :step="0.1" />
              </el-form-item>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <el-form-item label="Temperature">
                <el-input-number
                  v-model="gptSovitsForm.temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                />
              </el-form-item>
              <el-form-item label="Speed">
                <el-input-number v-model="gptSovitsForm.speed" :min="0.5" :max="2" :step="0.1" />
              </el-form-item>
              <el-form-item label="Sample Steps">
                <el-input-number v-model="gptSovitsForm.sampleSteps" :min="1" :max="128" />
              </el-form-item>
            </div>
            <div class="text-xs text-gray-500 leading-6">
              从服务器目录选择 GPT (*.ckpt) / SoVITS (*.pth) 模型文件。Prompt 音频支持直接上传本地
              wav/mp3/m4a/flac/ogg 文件。
              <el-button
                type="primary"
                size="small"
                @click="loadServerFiles"
                :loading="loadingFiles"
                >刷新文件列表</el-button
              >
              <div v-if="serverFiles.storageRoot" class="text-gray-400 mt-1">
                当前存储目录：{{ serverFiles.storageRoot }}
                <el-link type="primary" @click.prevent="goToModelLibrary" class="ml-2"
                  >模型管理</el-link
                >
              </div>
            </div>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="MiniMax 语音克隆" name="minimax">
          <el-form :model="minimaxForm" label-width="120px" class="space-y-3">
            <el-radio-group v-model="minimaxForm.mode" class="mb-4">
              <el-radio label="clone">上传音频进行语音克隆</el-radio>
              <el-radio label="design">AI音色设计（文字描述生成）</el-radio>
              <el-radio label="link">关联已有 MiniMax 音色ID</el-radio>
            </el-radio-group>

            <el-form-item label="名称">
              <el-input v-model="minimaxForm.name" placeholder="给该音色起个名字（便于识别）" />
            </el-form-item>

            <template v-if="minimaxForm.mode === 'clone'">
              <el-form-item label="样本音频">
                <div class="flex flex-col gap-2 w-full">
                  <el-upload
                    :auto-upload="false"
                    :show-file-list="false"
                    accept=".wav,.mp3,.m4a"
                    @change="onMinimaxAudioFileChange"
                  >
                    <el-button>{{
                      minimaxForm.audioFile ? '重新选择音频' : '上传音频文件'
                    }}</el-button>
                  </el-upload>
                  <div
                    v-if="minimaxForm.audioFileName"
                    class="text-xs text-gray-500 flex items-center gap-2"
                  >
                    <span>
                      {{ minimaxForm.audioFileName }}
                      <template v-if="minimaxForm.audioFileSize">
                        （{{ formatFileSize(minimaxForm.audioFileSize) }}）
                      </template>
                    </span>
                    <el-button link type="danger" @click="clearMinimaxAudioFile">清除</el-button>
                  </div>
                </div>
                <template #extra>
                  <div class="text-xs text-gray-500 leading-5">
                    要求：mp3/m4a/wav 格式，10秒-5分钟，不超过20MB。
                  </div>
                </template>
              </el-form-item>
              <el-form-item label="音频文本">
                <el-input
                  v-model="minimaxForm.promptText"
                  type="textarea"
                  :rows="2"
                  placeholder="输入音频中说话的文本内容（可选，填写后可提升克隆质量）"
                />
                <template #extra>
                  <div class="text-xs text-gray-500 leading-5">
                    建议填写音频中实际说话的文本，可提升克隆音色的准确度。
                  </div>
                </template>
              </el-form-item>
              <el-form-item label="试听文本">
                <el-input
                  v-model="minimaxForm.testText"
                  type="textarea"
                  :rows="2"
                  placeholder="输入克隆完成后希望播放的试听文本，如：你好，我上线啦。"
                />
                <template #extra>
                  <div class="text-xs text-gray-500 leading-5">
                    该文本将作为 MiniMax 合成试听音频的内容，可自由填写以便快速验证音色。
                  </div>
                </template>
              </el-form-item>
            </template>

            <template v-else-if="minimaxForm.mode === 'design'">
              <el-form-item label="音色风格描述">
                <el-input
                  v-model="minimaxForm.designPrompt"
                  type="textarea"
                  :rows="3"
                  placeholder="描述你想要的音色风格，例如：讲述悬疑故事的播音员，声音低沉富有磁性，语速时快时慢，营造紧张神秘的氛围。"
                />
                <template #extra>
                  <div class="text-xs text-gray-500 leading-5">
                    尽可能详细描述音色的风格特点，如性别、年龄、音色特征、情感色彩、语速节奏等。
                  </div>
                </template>
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="MiniMax 音色ID">
                <el-input
                  v-model="minimaxForm.minimaxVoiceId"
                  placeholder="输入 MiniMax 音色ID（如 audiobook_male_1）"
                />
                <template #extra>
                  <div class="text-xs text-gray-500 leading-5">
                    可以是 MiniMax 预置音色ID 或 通过语音克隆获得的 file_id
                  </div>
                </template>
              </el-form-item>
            </template>

            <template v-if="minimaxForm.mode !== 'design'">
              <el-divider content-position="left">合成参数（可选）</el-divider>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <el-form-item label="模型">
                  <el-select v-model="minimaxForm.model" style="width: 100%">
                    <el-option label="speech-2.6-hd" value="speech-2.6-hd" />
                    <el-option label="speech-01-hd" value="speech-01-hd" />
                    <el-option label="speech-02-hd" value="speech-02-hd" />
                    <el-option label="speech-02-turbo" value="speech-02-turbo" />
                  </el-select>
                </el-form-item>
                <el-form-item label="语速">
                  <el-input-number v-model="minimaxForm.speed" :min="0.5" :max="2" :step="0.1" />
                </el-form-item>
                <el-form-item label="音量">
                  <el-input-number v-model="minimaxForm.vol" :min="0.1" :max="10" :step="0.1" />
                </el-form-item>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <el-form-item label="音调">
                  <el-input-number v-model="minimaxForm.pitch" :min="-12" :max="12" :step="1" />
                </el-form-item>
                <el-form-item label="语言增强">
                  <el-select v-model="minimaxForm.languageBoost" style="width: 100%">
                    <el-option label="自动 (auto)" value="auto" />
                    <el-option label="中文 (zh)" value="zh" />
                    <el-option label="英文 (en)" value="en" />
                    <el-option label="日语 (ja)" value="ja" />
                    <el-option label="韩语 (ko)" value="ko" />
                  </el-select>
                </el-form-item>
              </div>
            </template>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="createVoiceDialog.visible = false">取消</el-button>
          <el-button
            v-if="createVoiceDialog.active === 'api'"
            type="primary"
            :disabled="!canSubmitApiVoice"
            :loading="enrolling"
            @click="submitApiVoice"
            >提交复刻</el-button
          >
          <el-button
            v-else-if="createVoiceDialog.active === 'gpt'"
            type="primary"
            :loading="gptSovitsForm.uploading"
            @click="onSubmitGptSovits"
            >上传模型</el-button
          >
          <el-button
            v-else-if="createVoiceDialog.active === 'minimax'"
            type="primary"
            :loading="minimaxForm.uploading"
            @click="onSubmitMinimax"
            >{{
              minimaxForm.mode === 'clone'
                ? '上传克隆'
                : minimaxForm.mode === 'design'
                  ? '生成音色'
                  : '关联音色'
            }}</el-button
          >
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="previewDialog.visible" title="试听合成" width="560px">
      <el-form label-width="80px">
        <el-form-item label="文本">
          <el-input
            v-model="previewDialog.text"
            type="textarea"
            :rows="3"
            placeholder="输入要合成的文本"
          />
        </el-form-item>
        <el-form-item label="文本语言" v-if="previewDialog.provider === 'gpt-sovits'">
          <el-select v-model="previewDialog.textLanguage" style="width: 220px">
            <el-option v-for="lang in gptSovitsLanguages" :key="lang" :label="lang" :value="lang" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型" v-if="previewDialog.provider === 'dashscope'">
          <el-select v-model="previewDialog.model" style="width: 220px">
            <el-option label="cosyvoice-v2" value="cosyvoice-v2" />
            <el-option label="cosyvoice-v3" value="cosyvoice-v3" />
            <el-option label="cosyvoice-v3-plus" value="cosyvoice-v3-plus" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型" v-if="previewDialog.provider === 'minimax'">
          <el-select v-model="previewDialog.model" style="width: 220px">
            <el-option label="speech-2.6-hd" value="speech-2.6-hd" />
            <el-option label="speech-01-hd" value="speech-01-hd" />
            <el-option label="speech-02-hd" value="speech-02-hd" />
            <el-option label="speech-02-turbo" value="speech-02-turbo" />
          </el-select>
        </el-form-item>
        <el-form-item label="格式">
          <el-select
            v-model="previewDialog.format"
            style="width: 220px"
            :disabled="
              previewDialog.provider === 'gpt-sovits' || previewDialog.provider === 'minimax'
            "
          >
            <el-option label="mp3" value="mp3" />
            <el-option label="wav" value="wav" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="flex items-center justify-between w-full">
          <audio v-if="previewDialog.url" :src="previewDialog.url" controls style="height: 36px" />
          <div class="flex-1"></div>
          <el-button @click="previewDialog.visible = false">取消</el-button>
          <el-button type="primary" :loading="previewDialog.loading" @click="onPreview"
            >生成试听</el-button
          >
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="minimaxDemoPreview.visible" title="MiniMax 试听链接" width="520px">
      <div class="space-y-3">
        <div class="text-sm text-gray-500">
          MiniMax 成功创建音色后会返回试听地址，你可以直接在此播放验证音色质量。
        </div>
        <div v-if="minimaxDemoPreview.voiceId" class="text-xs text-gray-500 break-all">
          本地 Voice ID：{{ minimaxDemoPreview.voiceId }}
        </div>
        <div v-if="minimaxDemoPreview.minimaxVoiceId" class="text-xs text-gray-500 break-all">
          MiniMax 音色ID：{{ minimaxDemoPreview.minimaxVoiceId }}
        </div>
        <div>
          <audio
            v-if="minimaxDemoPreview.url"
            :src="minimaxDemoPreview.url"
            controls
            style="width: 100%"
          />
          <a
            v-if="minimaxDemoPreview.url"
            :href="minimaxDemoPreview.url"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-2 inline-flex items-center text-blue-500 text-sm"
          >
            新窗口打开试听链接
          </a>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="minimaxDemoPreview.visible = false">知道了</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="debugDialog.visible" title="调试参数" width="780px">
      <el-form label-width="100px">
        <el-form-item label="文本">
          <el-input
            v-model="debugDialog.text"
            type="textarea"
            :rows="3"
            placeholder="输入批量测试文本"
          />
        </el-form-item>
        <div class="flex gap-2">
          <el-form-item label="语速范围">
            <div class="flex items-center gap-2">
              <el-input-number
                v-model="debugDialog.rateMin"
                :min="-100"
                :max="100"
                :step="0.1"
                :precision="1"
              />
              <span>至</span>
              <el-input-number
                v-model="debugDialog.rateMax"
                :min="-100"
                :max="100"
                :step="0.1"
                :precision="1"
              />
              <span>步长</span>
              <el-input-number
                v-model="debugDialog.rateStep"
                :min="0.1"
                :max="50"
                :step="0.1"
                :precision="1"
              />
            </div>
          </el-form-item>
          <el-form-item label="语调范围">
            <div class="flex items-center gap-2">
              <el-input-number
                v-model="debugDialog.pitchMin"
                :min="-12"
                :max="12"
                :step="0.1"
                :precision="1"
              />
              <span>至</span>
              <el-input-number
                v-model="debugDialog.pitchMax"
                :min="-12"
                :max="12"
                :step="0.1"
                :precision="1"
              />
              <span>步长</span>
              <el-input-number
                v-model="debugDialog.pitchStep"
                :min="0.1"
                :max="6"
                :step="0.1"
                :precision="1"
              />
            </div>
          </el-form-item>
        </div>
        <div class="flex gap-2">
          <el-form-item label="音量">
            <el-input-number v-model="debugDialog.volume" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="格式">
            <el-select v-model="debugDialog.format" style="width: 160px">
              <el-option label="mp3" value="mp3" />
              <el-option label="wav" value="wav" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>

      <div class="mb-3">
        <el-button @click="debugDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="debugDialog.generating" @click="onGenerateDebug"
          >生成语音列表</el-button
        >
      </div>

      <el-table v-if="debugDialog.items.length" :data="debugDialog.items" size="small">
        <el-table-column label="语速" prop="rate" width="100" />
        <el-table-column label="语调" prop="pitch" width="100" />
        <el-table-column label="试听" min-width="360">
          <template #default="scope">
            <audio v-if="scope.row.url" :src="scope.row.url" controls style="height: 36px" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button size="small" type="success" @click="chooseDebug(scope.row)">选中</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 设置名称（项目内弹窗） -->
    <el-dialog v-model="setNameDialog.visible" title="设置名称" width="420px">
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="setNameDialog.name" placeholder="输入音色名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="setNameDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="setNameDialog.saving" @click="onConfirmSetName"
          >保存</el-button
        >
      </template>
    </el-dialog>

    <!-- 单独设置默认参数（不走批量调试） -->
    <el-dialog v-model="paramDialog.visible" title="设置默认参数" width="780px">
      <el-form label-width="100px">
        <el-form-item label="文本">
          <el-input
            v-model="paramDialog.text"
            type="textarea"
            :rows="2"
            placeholder="可选：保存一个常用的合成默认文本"
          />
        </el-form-item>

        <!-- DashScope 参数 -->
        <template v-if="paramDialog.provider !== 'gpt-sovits'">
          <div class="flex gap-2">
            <el-form-item label="语速">
              <el-input-number
                v-model="paramDialog.rate"
                :min="-100"
                :max="100"
                :step="0.1"
                :precision="1"
              />
            </el-form-item>
            <el-form-item label="语调">
              <el-input-number
                v-model="paramDialog.pitch"
                :min="-12"
                :max="12"
                :step="0.1"
                :precision="1"
              />
            </el-form-item>
          </div>
          <div class="flex gap-2">
            <el-form-item label="音量">
              <el-input-number v-model="paramDialog.volume" :min="0" :max="100" />
            </el-form-item>
            <el-form-item label="格式">
              <el-select v-model="paramDialog.format" style="width: 160px">
                <el-option label="mp3" value="mp3" />
                <el-option label="wav" value="wav" />
              </el-select>
            </el-form-item>
          </div>
        </template>

        <!-- GPT-SoVITS 参数 -->
        <template v-else>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <el-form-item label="文本语言">
              <el-select v-model="paramDialog.textLanguage">
                <el-option
                  v-for="lang in gptSovitsLanguages"
                  :key="lang"
                  :label="lang"
                  :value="lang"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="Prompt语言">
              <el-select v-model="paramDialog.promptLanguage">
                <el-option
                  v-for="lang in gptSovitsLanguages"
                  :key="lang"
                  :label="lang"
                  :value="lang"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="文本分割">
              <el-select v-model="paramDialog.cutPunc">
                <el-option label="cut0 - 不分割" value="cut0" />
                <el-option label="cut1 - 每4句" value="cut1" />
                <el-option label="cut2 - 每50字" value="cut2" />
                <el-option label="cut3 - 按句号" value="cut3" />
                <el-option label="cut4 - 按英文句号" value="cut4" />
                <el-option label="cut5 - 按所有标点" value="cut5" />
              </el-select>
            </el-form-item>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <el-form-item label="Top K">
              <el-input-number v-model="paramDialog.topK" :min="0" :step="1" />
            </el-form-item>
            <el-form-item label="Top P">
              <el-input-number v-model="paramDialog.topP" :min="0" :max="1" :step="0.1" />
            </el-form-item>
            <el-form-item label="Temperature">
              <el-input-number v-model="paramDialog.temperature" :min="0" :max="2" :step="0.1" />
            </el-form-item>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <el-form-item label="Speed">
              <el-input-number v-model="paramDialog.speed" :min="0.5" :max="2" :step="0.1" />
            </el-form-item>
            <el-form-item label="Sample Steps">
              <el-input-number v-model="paramDialog.sampleSteps" :min="1" :max="128" />
            </el-form-item>
            <el-form-item label="格式">
              <el-select v-model="paramDialog.format" style="width: 160px">
                <el-option label="mp3" value="mp3" />
                <el-option label="wav" value="wav" />
              </el-select>
            </el-form-item>
          </div>
        </template>
      </el-form>
      <template #footer>
        <div class="flex items-center justify-between w-full">
          <div>
            <audio v-if="paramDialog.url" :src="paramDialog.url" controls style="height: 36px" />
          </div>
          <div>
            <el-button @click="paramDialog.visible = false">取消</el-button>
            <el-button :loading="paramDialog.previewing" @click="onParamPreview">试听</el-button>
            <el-button type="primary" :loading="paramDialog.saving" @click="onConfirmSetParams"
              >保存</el-button
            >
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 分类管理对话框 -->
    <el-dialog v-model="categoryManageDialog.visible" title="分类管理" width="800px">
      <div class="mb-3">
        <el-button type="primary" @click="openAddCategory">添加分类</el-button>
      </div>
      <el-table :data="categories" v-loading="categoryManageDialog.loading" size="small">
        <el-table-column prop="name" label="分类名称" width="150" />
        <el-table-column prop="description" label="描述" min-width="200" />
        <el-table-column prop="sort" label="排序" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.isEnabled ? 'success' : 'info'" size="small">
              {{ scope.row.isEnabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button size="small" @click="openEditCategory(scope.row)">编辑</el-button>
            <el-popconfirm title="确认删除该分类？" @confirm="onRemoveCategory(scope.row)">
              <template #reference>
                <el-button size="small" type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 添加/编辑分类对话框 -->
    <el-dialog
      v-model="categoryEditDialog.visible"
      :title="categoryEditDialog.isEdit ? '编辑分类' : '添加分类'"
      width="500px"
    >
      <el-form label-width="80px">
        <el-form-item label="分类名称">
          <el-input v-model="categoryEditDialog.name" placeholder="如：男声、女声、童声等" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="categoryEditDialog.description"
            type="textarea"
            :rows="3"
            placeholder="分类描述（可选）"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="categoryEditDialog.sort" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="categoryEditDialog.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryEditDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="categoryEditDialog.saving" @click="onSaveCategory"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import uploadApi from '@/api/modules/upload';
  import voiceApi from '@/api/modules/voice';
  import voiceCategoryApi from '@/api/modules/voiceCategory';
  import { ElMessage } from 'element-plus';
  import type { UploadFile } from 'element-plus';
  import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';

  type VoicePreviewPayload = Parameters<(typeof voiceApi)['preview']>[0];
  type GptSovitsLibraryEntry = {
    type: 'gpt' | 'sovits';
    filename: string;
    path: string;
    relativePath?: string;
    size?: number;
    updatedAt?: number;
  };

  const router = useRouter();
  const loading = ref(false);
  const enrolling = ref(false);
  const syncing = ref(false);
  const loadingFiles = ref(false);
  const hasLoadedGptLibrary = ref(false);

  const voices = ref<any[]>([]);
  const categories = ref<any[]>([]);

  // 服务器文件列表
  const serverFiles = reactive<{
    gptModels: string[];
    sovitsModels: string[];
    library: GptSovitsLibraryEntry[];
    storageRoot: string;
  }>({
    gptModels: [],
    sovitsModels: [],
    library: [],
    storageRoot: '',
  });

  const listQuery = reactive<{
    name?: string;
    prefix?: string;
    page_index?: number;
    page_size?: number;
    categoryId?: number;
  }>({
    page_index: 0,
    page_size: 10,
  });

  const uiPage = ref(1);
  const total = ref(0);
  const computedTotal = computed(() => Number(total.value) || 0);
  const gptLibraryOptions = computed<GptSovitsLibraryEntry[]>(() => buildLibraryOptions('gpt'));
  const sovitsLibraryOptions = computed<GptSovitsLibraryEntry[]>(() =>
    buildLibraryOptions('sovits'),
  );

  function onSearch() {
    listQuery.page_index = 0;
    uiPage.value = 1;
    fetchList();
  }

  function onPageChange(p: number) {
    uiPage.value = Number(p) || 1;
    listQuery.page_index = Math.max(0, uiPage.value - 1);
    fetchList();
  }

  function onPageSizeChange(size: number) {
    listQuery.page_size = Number(size) || 10;
    listQuery.page_index = 0;
    uiPage.value = 1;
    fetchList();
  }

  function openCreateVoice(mode: 'api' | 'gpt' = 'api') {
    createVoiceDialog.active = mode;
    createVoiceDialog.visible = true;
    // 如果是 GPT-SoVITS 模式，自动加载文件列表和角色列表
    if (mode === 'gpt') {
      loadServerFiles();
      if (!characters.value.length) {
        fetchCharacters();
      }
    }
  }

  async function submitApiVoice() {
    await onEnroll();
  }

  const createVoiceDialog = reactive<{ visible: boolean; active: 'api' | 'gpt' | 'minimax' }>({
    visible: false,
    active: 'api',
  });

  watch(
    () => createVoiceDialog.active,
    (activeTab) => {
      if (activeTab === 'gpt' && !hasLoadedGptLibrary.value) {
        loadServerFiles();
      }
      if (activeTab === 'gpt' && !characters.value.length) {
        fetchCharacters();
      }
    },
  );

  const enrollForm = reactive<{ prefix: string; url: string; name?: string }>({
    prefix: '',
    url: '',
    name: '',
  });
  const canSubmitApiVoice = computed(() => {
    return !!enrollForm.prefix && !!enrollForm.url;
  });

  const gptSovitsLanguages = [
    'auto',
    'zh',
    'en',
    'ja',
    'ko',
    'yue',
    'all_zh',
    'all_ja',
    'all_ko',
    'all_yue',
  ];

  interface GptSovitsFormState {
    name: string;
    voiceId: string;
    characterName: string; // 新增角色名称
    promptText: string;
    promptLanguage: string;
    textLanguage: string;
    cutPunc: string;
    sampleRate: number;
    topK?: number;
    topP?: number;
    temperature?: number;
    speed?: number;
    sampleSteps?: number;
    gptModelPath: string;
    sovitsModelPath: string;
    promptAudioFile: File | null;
    promptAudioFileName: string;
    promptAudioFileSize: number;
    uploading: boolean;
  }

  const defaultGptSovits: GptSovitsFormState = {
    name: '',
    voiceId: '',
    characterName: '', // 初始化角色名称
    promptText: '',
    promptLanguage: 'auto',
    textLanguage: 'auto', // 改为 auto 支持多语种
    cutPunc: 'cut5', // 默认使用 cut5 按所有标点分割
    sampleRate: 32000,
    topK: 15,
    topP: 0.7,
    temperature: 0.7,
    speed: 1,
    sampleSteps: 32,
    gptModelPath: '',
    sovitsModelPath: '',
    promptAudioFile: null,
    promptAudioFileName: '',
    promptAudioFileSize: 0,
    uploading: false,
  };

  const gptSovitsForm = reactive<GptSovitsFormState>({ ...defaultGptSovits });

  // MiniMax 表单状态
  interface MinimaxFormState {
    mode: 'clone' | 'link' | 'design';
    name: string;
    audioFile: File | null;
    audioFileName: string;
    audioFileSize: number;
    promptText: string; // 音频对应的文本
    testText: string; // 试听文本
    minimaxVoiceId: string;
    model: string;
    speed: number;
    vol: number;
    pitch: number;
    languageBoost: string;
    uploading: boolean;
    // 音色设计相关
    designPrompt: string; // 音色风格描述
  }

  const defaultMinimax: MinimaxFormState = {
    mode: 'clone',
    name: '',
    audioFile: null,
    audioFileName: '',
    audioFileSize: 0,
    promptText: '',
    testText: '你好，这是语音克隆测试。',
    minimaxVoiceId: '',
    model: 'speech-2.6-hd',
    speed: 1,
    vol: 1,
    pitch: 0,
    languageBoost: 'auto',
    uploading: false,
    designPrompt: '',
  };

  const minimaxForm = reactive<MinimaxFormState>({ ...defaultMinimax });

  const minimaxDemoPreview = reactive<{
    visible: boolean;
    url: string;
    voiceId: string;
    minimaxVoiceId: string;
  }>({
    visible: false,
    url: '',
    voiceId: '',
    minimaxVoiceId: '',
  });

  function showMinimaxDemoPreview(payload?: {
    demo_audio?: string;
    voice_id?: string;
    minimax_voice_id?: string;
  }) {
    minimaxDemoPreview.url = payload?.demo_audio || '';
    minimaxDemoPreview.voiceId = payload?.voice_id || '';
    minimaxDemoPreview.minimaxVoiceId = payload?.minimax_voice_id || '';
    minimaxDemoPreview.visible = Boolean(minimaxDemoPreview.url);
  }

  function onMinimaxAudioFileChange(uploadFile: UploadFile) {
    const rawFile = uploadFile?.raw || null;
    minimaxForm.audioFile = rawFile;
    minimaxForm.audioFileName = rawFile?.name || uploadFile?.name || '';
    minimaxForm.audioFileSize = rawFile?.size || uploadFile?.size || 0;
  }

  function clearMinimaxAudioFile() {
    minimaxForm.audioFile = null;
    minimaxForm.audioFileName = '';
    minimaxForm.audioFileSize = 0;
  }

  function resetMinimaxForm() {
    Object.assign(minimaxForm, { ...defaultMinimax });
  }

  async function onSubmitMinimax() {
    if (minimaxForm.mode === 'clone') {
      // 上传音频进行语音克隆
      if (!minimaxForm.audioFile) {
        ElMessage.warning('请上传音频文件');
        return;
      }
      minimaxForm.uploading = true;
      try {
        const fd = new FormData();
        fd.append('audioFile', minimaxForm.audioFile, minimaxForm.audioFile.name || 'audio.wav');
        if (minimaxForm.name) fd.append('name', minimaxForm.name);
        if (minimaxForm.promptText) fd.append('promptText', minimaxForm.promptText);
        if (minimaxForm.testText) fd.append('testText', minimaxForm.testText);
        const result = await voiceApi.importMinimax(fd);
        ElMessage.success('语音克隆成功');
        showMinimaxDemoPreview(result.data);
        resetMinimaxForm();
        if (createVoiceDialog.visible) createVoiceDialog.visible = false;
        createVoiceDialog.active = 'api';
        fetchList();
      } catch (e: any) {
        ElMessage.error(e?.message || '语音克隆失败');
      } finally {
        minimaxForm.uploading = false;
      }
    } else if (minimaxForm.mode === 'design') {
      // 音色设计：通过文字描述生成AI音色
      if (!minimaxForm.designPrompt.trim()) {
        ElMessage.warning('请输入音色风格描述');
        return;
      }
      minimaxForm.uploading = true;
      try {
        await voiceApi.designMinimax({
          name: minimaxForm.name || undefined,
          prompt: minimaxForm.designPrompt,
        });
        ElMessage.success('音色生成成功，可在列表中试听');
        resetMinimaxForm();
        if (createVoiceDialog.visible) createVoiceDialog.visible = false;
        createVoiceDialog.active = 'api';
        fetchList();
      } catch (e: any) {
        ElMessage.error(e?.message || '音色设计失败');
      } finally {
        minimaxForm.uploading = false;
      }
    } else {
      // 关联已有音色ID
      if (!minimaxForm.minimaxVoiceId.trim()) {
        ElMessage.warning('请输入 MiniMax 音色ID');
        return;
      }
      minimaxForm.uploading = true;
      try {
        await voiceApi.linkMinimax({
          name: minimaxForm.name || undefined,
          minimaxVoiceId: minimaxForm.minimaxVoiceId,
          model: minimaxForm.model,
          speed: minimaxForm.speed,
          vol: minimaxForm.vol,
          pitch: minimaxForm.pitch,
          languageBoost: minimaxForm.languageBoost,
        });
        ElMessage.success('音色关联成功');
        resetMinimaxForm();
        if (createVoiceDialog.visible) createVoiceDialog.visible = false;
        createVoiceDialog.active = 'api';
        fetchList();
      } catch (e: any) {
        ElMessage.error(e?.message || '关联失败');
      } finally {
        minimaxForm.uploading = false;
      }
    }
  }

  // 角色列表
  const charactersLoading = ref(false);
  const characters = ref<string[]>([]);

  async function fetchCharacters() {
    try {
      charactersLoading.value = true;
      const res = await voiceApi.listGptSovitsCharacters();
      characters.value = res?.data?.characters || [];
      ElMessage.success(`加载了 ${characters.value.length} 个角色`);
    } catch (e: any) {
      console.error('获取角色列表失败:', e);
      ElMessage.warning('无法获取角色列表，请检查 GPT-SoVITS 服务');
      characters.value = [];
    } finally {
      charactersLoading.value = false;
    }
  }

  async function fetchList() {
    loading.value = true;
    try {
      const res = await voiceApi.list({
        name: listQuery.name,
        prefix: listQuery.prefix,
        page_index: listQuery.page_index,
        page_size: listQuery.page_size,
        categoryId: listQuery.categoryId,
      });
      // 统一兼容返回结构（兼容 data.output.voice_list / voices），并做字段映射
      const body: any = res || {};
      const rawList =
        body?.rows ??
        body?.data?.rows ??
        body?.data?.voices ??
        body?.voices ??
        body?.data?.output?.voices ??
        body?.output?.voices ??
        body?.data?.output?.voice_list ??
        body?.output?.voice_list ??
        (Array.isArray(body) ? body : []);
      const arr = Array.isArray(rawList) ? rawList : [];
      voices.value = arr.map((item: any) => {
        const id = item?.voice_id || item?.id || '';
        const parts = (id || '').split('-');
        const prefix = parts.length >= 3 ? parts[2] : '';
        let status = String(item?.status || '').toUpperCase();
        if (status === 'OK') status = 'SUCCEEDED';
        const rawName = item?.name ?? item?.data?.name ?? item?.meta?.name ?? '';
        const name = String(rawName || '').trim();
        return { ...item, prefix, status, name, provider: item?.provider || 'dashscope' };
      });

      // 更新分页信息（尽量兼容不同返回结构）
      const totalCandidate = Number(
        body?.count ??
          body?.data?.count ??
          body?.data?.total ??
          body?.total ??
          body?.data?.output?.total ??
          body?.output?.total ??
          body?.data?.total_count ??
          body?.total_count ??
          body?.data?.output?.total_count ??
          body?.output?.total_count ??
          body?.data?.totalSize ??
          body?.totalSize ??
          body?.data?.totalElements ??
          body?.totalElements ??
          0,
      );
      const pageIndexNum = Number(listQuery.page_index) || 0;
      const pageSizeNum = Number(listQuery.page_size) || 10;
      const est = pageIndexNum * pageSizeNum + arr.length;
      if (Number.isFinite(totalCandidate) && totalCandidate > 0) {
        // 如果后端给出的 count 和当前页已知最小总数一致，且当前页满额，
        // 允许再多出一页，便于用户点到下一页探测是否还有数据（上游有时不给总数或给的是当前页计数）
        if (totalCandidate <= est && arr.length === pageSizeNum) {
          total.value = est + 1;
        } else {
          total.value = Math.max(totalCandidate, est);
        }
      } else {
        // 无总数字段时，回退为“已知最小总数”估算，保证分页可用
        total.value = est;
      }
      uiPage.value = pageIndexNum + 1;

      // 拉取每个音色的元信息（如名称）
      try {
        await Promise.all(
          voices.value.map(async (v: any) => {
            try {
              const r = await voiceApi.getMeta(v.voice_id || v.id);
              const meta = (r && (r.data || r)) || ({} as any);
              const metaName = meta?.name || meta?.data?.name || meta?.data?.data?.name || '';
              const fallback = deriveNameFromVoiceId(v.voice_id || v.id);
              v.name = metaName || v.name || fallback;
            } catch (_) {
              v.name = v.name || deriveNameFromVoiceId(v.voice_id || v.id);
            }
          }),
        );
      } catch (_) {}
    } catch (e: any) {
      ElMessage.error(e?.message || '获取列表失败');
    } finally {
      loading.value = false;
    }
  }

  const customUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await uploadApi.uploadFile(form, 'voice');
      const url = res?.data?.data || res?.data; // 兼容两种返回
      if (!url) throw new Error('未获取到URL');
      enrollForm.url = url;
      onSuccess && onSuccess(res);
      ElMessage.success('音频上传成功');
    } catch (err: any) {
      onError && onError(err);
      ElMessage.error(err?.message || '音频上传失败');
    }
  };

  async function onEnroll() {
    enrolling.value = true;
    try {
      const res = await voiceApi.enroll({
        prefix: enrollForm.prefix,
        url: enrollForm.url,
        name: enrollForm.name,
      });
      const body: any = res || {};
      const ok = !!(body?.output || body?.data || body?.request_id || body?.id);
      const vid = body?.output?.voice_id || body?.voice_id || body?.data?.voice_id;
      if (ok) {
        ElMessage.success(`已提交复刻训练${vid ? '（Voice ID: ' + vid + '）' : ''}`);
        enrollForm.prefix = '';
        enrollForm.url = '';
        if (createVoiceDialog.visible) createVoiceDialog.visible = false;
        createVoiceDialog.active = 'api';
        fetchList();
      } else {
        console.warn('Enroll response unexpected shape:', body);
        ElMessage.warning('请求成功但未返回预期数据');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '提交失败';
      ElMessage.error(msg);
    } finally {
      enrolling.value = false;
    }
  }

  function resetGptSovitsForm() {
    Object.assign(gptSovitsForm, { ...defaultGptSovits });
  }

  // 获取文件名（从路径中提取）
  function getFileName(filePath: string): string {
    if (!filePath) return '';
    // 处理 Windows 和 Unix 路径
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || filePath;
  }

  function deriveRelativePath(filePath: string): string {
    if (!filePath) return '';
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedRoot = serverFiles.storageRoot.replace(/\\/g, '/');
    if (normalizedRoot && normalizedPath.startsWith(normalizedRoot)) {
      return (
        normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, '') || getFileName(filePath)
      );
    }
    return getFileName(filePath);
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function formatLibraryLabel(entry: GptSovitsLibraryEntry): string {
    const rel = entry.relativePath || deriveRelativePath(entry.path);
    const sizeLabel = formatFileSize(entry.size);
    return sizeLabel ? `${rel} (${sizeLabel})` : rel;
  }

  function buildLibraryOptions(type: 'gpt' | 'sovits'): GptSovitsLibraryEntry[] {
    if (serverFiles.library.length) {
      return [...serverFiles.library]
        .filter((entry) => entry.type === type)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    const fallback = type === 'gpt' ? serverFiles.gptModels : serverFiles.sovitsModels;
    return fallback.map((path) => ({
      type,
      filename: getFileName(path),
      path,
      relativePath: deriveRelativePath(path),
    }));
  }

  // 加载服务器文件列表
  async function loadServerFiles() {
    loadingFiles.value = true;
    try {
      const fetcher = voiceApi.listGptSovitsLibrary || voiceApi.listGptSovitsFiles;
      const res = await fetcher();
      const data = res?.data || res;
      serverFiles.storageRoot = data.storageRoot || '';
      serverFiles.library = Array.isArray(data.library) ? data.library : [];
      if (serverFiles.library.length) {
        serverFiles.gptModels = serverFiles.library
          .filter((entry) => entry.type === 'gpt')
          .map((entry) => entry.path);
        serverFiles.sovitsModels = serverFiles.library
          .filter((entry) => entry.type === 'sovits')
          .map((entry) => entry.path);
      } else {
        serverFiles.gptModels = data.gptModels || [];
        serverFiles.sovitsModels = data.sovitsModels || [];
      }
      hasLoadedGptLibrary.value = true;
      ElMessage.success('文件列表已刷新');
    } catch (e: any) {
      ElMessage.error(e?.message || '获取文件列表失败');
    } finally {
      loadingFiles.value = false;
    }
  }

  function onPromptAudioFileChange(uploadFile: UploadFile) {
    const rawFile = uploadFile?.raw || null;
    gptSovitsForm.promptAudioFile = rawFile;
    gptSovitsForm.promptAudioFileName = rawFile?.name || uploadFile?.name || '';
    gptSovitsForm.promptAudioFileSize = rawFile?.size || uploadFile?.size || 0;
    if (!gptSovitsForm.promptText.trim() && gptSovitsForm.promptAudioFileName) {
      gptSovitsForm.promptText = gptSovitsForm.promptAudioFileName.replace(/\.[^.]+$/, '');
    }
  }

  function clearPromptAudioFile() {
    gptSovitsForm.promptAudioFile = null;
    gptSovitsForm.promptAudioFileName = '';
    gptSovitsForm.promptAudioFileSize = 0;
  }

  async function onSubmitGptSovits() {
    // 如果选择了角色，只需要角色名和Prompt文本
    if (gptSovitsForm.characterName) {
      if (!gptSovitsForm.promptText.trim()) {
        ElMessage.warning('Prompt 文本不能为空');
        return;
      }
      if (!gptSovitsForm.promptAudioFile) {
        ElMessage.warning('请上传 Prompt 音频');
        return;
      }
    } else {
      // 未选择角色，需要手动选择模型
      if (!gptSovitsForm.promptText.trim()) {
        ElMessage.warning('Prompt 文本不能为空');
        return;
      }
      if (!gptSovitsForm.gptModelPath || !gptSovitsForm.sovitsModelPath) {
        ElMessage.warning('请选择 GPT 模型和 SoVITS 模型，或选择一个角色');
        return;
      }
      if (!gptSovitsForm.promptAudioFile) {
        ElMessage.warning('请上传 Prompt 音频');
        return;
      }
    }

    gptSovitsForm.uploading = true;
    try {
      const fd = new FormData();
      fd.append('useServerFiles', 'true');
      if (gptSovitsForm.name) fd.append('name', gptSovitsForm.name);
      if (gptSovitsForm.voiceId) fd.append('voiceId', gptSovitsForm.voiceId);

      // 如果选择了角色，传递角色名
      if (gptSovitsForm.characterName) {
        fd.append('characterName', gptSovitsForm.characterName);
      } else {
        // 否则传递模型路径
        fd.append('gptModelPath', gptSovitsForm.gptModelPath);
        fd.append('sovitsModelPath', gptSovitsForm.sovitsModelPath);
      }

      fd.append('promptText', gptSovitsForm.promptText);
      fd.append('promptLanguage', gptSovitsForm.promptLanguage);
      fd.append('textLanguage', gptSovitsForm.textLanguage);
      if (gptSovitsForm.cutPunc) fd.append('cutPunc', gptSovitsForm.cutPunc);
      fd.append('sampleRate', String(gptSovitsForm.sampleRate));
      if (gptSovitsForm.topK !== undefined) fd.append('topK', String(gptSovitsForm.topK));
      if (gptSovitsForm.topP !== undefined) fd.append('topP', String(gptSovitsForm.topP));
      if (gptSovitsForm.temperature !== undefined)
        fd.append('temperature', String(gptSovitsForm.temperature));
      if (gptSovitsForm.speed !== undefined) fd.append('speed', String(gptSovitsForm.speed));
      if (gptSovitsForm.sampleSteps !== undefined)
        fd.append('sampleSteps', String(gptSovitsForm.sampleSteps));
      fd.append(
        'promptAudio',
        gptSovitsForm.promptAudioFile,
        gptSovitsForm.promptAudioFile.name || 'prompt-audio.wav',
      );
      await voiceApi.importGptSovits(fd);
      ElMessage.success('导入成功');
      resetGptSovitsForm();
      if (createVoiceDialog.visible) createVoiceDialog.visible = false;
      createVoiceDialog.active = 'api';
      fetchList();
    } catch (e: any) {
      ElMessage.error(e?.message || '导入失败');
    } finally {
      gptSovitsForm.uploading = false;
    }
  }

  async function onQuery(row: any) {
    if (row.provider === 'gpt-sovits') {
      ElMessage.info('GPT-SoVITS 音色无需查询，状态保持本地记录');
      return;
    }
    try {
      const res = await voiceApi.detail(row.voice_id || row.id || row.voiceId);
      const data = res?.data?.data || res?.data || {};
      ElMessage.success(`状态：${data?.status || data?.result?.status || '未知'}`);

      fetchList();
    } catch (e: any) {
      ElMessage.error(e?.message || '查询失败');
    }
  }

  async function onRemove(row: any) {
    try {
      await voiceApi.remove({ voice_id: row.voice_id });
      ElMessage.success('已删除');
      fetchList();
    } catch (e: any) {
      ElMessage.error(e?.message || '删除失败');
    }
  }

  const previewDialog = reactive<{
    visible: boolean;

    text: string;

    model: string;

    format: 'mp3' | 'wav';

    provider: 'dashscope' | 'gpt-sovits' | 'minimax';

    textLanguage: string;

    voice_id?: string;

    url?: string;

    loading: boolean;
  }>({
    visible: false,

    text: '你好，这是AI语音合成试听文案。',

    model: 'cosyvoice-v2',

    format: 'mp3',

    provider: 'dashscope',

    textLanguage: 'zh',

    voice_id: undefined,

    url: undefined,

    loading: false,
  });

  function deriveModelFromVoiceId(id?: string) {
    const v = (id || '').toLowerCase();
    if (v.startsWith('cosyvoice-v3-plus-')) return 'cosyvoice-v3-plus';
    if (v.startsWith('cosyvoice-v3-')) return 'cosyvoice-v3';
    if (v.startsWith('cosyvoice-v2-')) return 'cosyvoice-v2';
    return previewDialog.model;
  }

  function deriveNameFromVoiceId(id?: string) {
    const parts = (id || '').split('-');
    if (parts.length >= 3) return parts.slice(0, 3).join('-');
    return id || '';
  }

  function openPreview(row: any) {
    previewDialog.visible = true;
    previewDialog.voice_id = row.voice_id;
    previewDialog.provider = row.provider || 'dashscope';
    // 根据 provider 设置模型
    if (previewDialog.provider === 'gpt-sovits') {
      previewDialog.model = 'gpt-sovits';
      previewDialog.format = 'wav';
    } else if (previewDialog.provider === 'minimax') {
      previewDialog.model = 'speech-2.6-hd';
      previewDialog.format = 'mp3';
    } else {
      previewDialog.model = deriveModelFromVoiceId(row.voice_id);
      previewDialog.format = 'mp3';
    }
    previewDialog.textLanguage = row.text_language || gptSovitsForm.textLanguage || 'zh';
    previewDialog.url = undefined;
  }

  // 跳转到测试页面的参数调节步骤
  function goToTestPage(row: any) {
    router.push({
      path: '/voice/test',
      query: {
        voiceId: row.voice_id || row.id,
        step: '2', // 直接进入第3步（参数调节）
      },
    });
  }

  function goToModelLibrary() {
    router.push({ name: 'VoiceGptModels' });
  }

  const debugDialog = reactive<{
    visible: boolean;
    voice_id?: string;
    model: string;
    text: string;
    format: 'mp3' | 'wav';
    volume: number;
    rateMin: number;
    rateMax: number;
    rateStep: number;
    pitchMin: number;
    pitchMax: number;
    pitchStep: number;

    generating: boolean;
    items: Array<{ rate: number; pitch: number; url?: string }>;
  }>({
    visible: false,
    voice_id: undefined,
    model: 'cosyvoice-v2',
    text: '你好，这是参数调试批量测试文本。',
    format: 'mp3',
    volume: 100,
    rateMin: -20,
    rateMax: 20,
    rateStep: 10,
    pitchMin: -2,
    pitchMax: 2,
    pitchStep: 2,
    generating: false,
    items: [],
  });

  async function openDebug(row: any) {
    debugDialog.visible = true;
    debugDialog.voice_id = row.voice_id;
    debugDialog.model = deriveModelFromVoiceId(row.voice_id);
    debugDialog.items = [];
    try {
      const res = await voiceApi.getParams(row.voice_id);
      const data = res?.data?.data || res?.data || {};
      if (data && typeof data === 'object') {
        if (typeof data.rate === 'number') {
          debugDialog.rateMin = data.rate;
          debugDialog.rateMax = data.rate;
        }
        if (typeof data.pitch === 'number') {
          debugDialog.pitchMin = data.pitch;
          debugDialog.pitchMax = data.pitch;
        }
        if (typeof data.volume === 'number') debugDialog.volume = data.volume;
        if (typeof data.text === 'string') debugDialog.text = data.text;
        if (typeof data.format === 'string') debugDialog.format = data.format;
      }
    } catch (e) {
      // 忽略未设置参数的情况
    }
  }

  function makeRange(min: number, max: number, step: number) {
    const arr: number[] = [];
    if (step <= 0) step = 1;
    if (min > max) [min, max] = [max, min];
    for (let v = min; v <= max; v += step) arr.push(Number(v.toFixed(6)));
    if (arr.length === 0) arr.push(min);
    return arr;
  }

  async function onGenerateDebug() {
    if (!debugDialog.voice_id || !debugDialog.text) {
      ElMessage.warning('请完善文本');
      return;
    }
    const rates = makeRange(debugDialog.rateMin, debugDialog.rateMax, debugDialog.rateStep);
    const pitchs = makeRange(debugDialog.pitchMin, debugDialog.pitchMax, debugDialog.pitchStep);
    const combos: Array<{ rate: number; pitch: number }> = [];
    for (const r of rates) for (const p of pitchs) combos.push({ rate: r, pitch: p });
    if (!combos.length) {
      ElMessage.warning('没有可生成的组合');
      return;
    }

    debugDialog.generating = true;
    debugDialog.items = [];
    try {
      for (const c of combos) {
        try {
          const res = await voiceApi.preview({
            voice_id: debugDialog.voice_id,
            text: debugDialog.text,
            model: debugDialog.model,
            format: debugDialog.format,
            rate: c.rate,
            pitch: c.pitch,
            volume: debugDialog.volume,
          });
          const url = res?.data?.data?.url || res?.data?.url;
          debugDialog.items.push({ rate: c.rate, pitch: c.pitch, url });
        } catch (e) {
          debugDialog.items.push({ rate: c.rate, pitch: c.pitch });
        }
      }
      ElMessage.success('批量生成完成');
    } finally {
      debugDialog.generating = false;
    }
  }

  async function chooseDebug(item: { rate: number; pitch: number }) {
    if (!debugDialog.voice_id) return;
    try {
      await voiceApi.setParams({
        voice_id: debugDialog.voice_id,
        params: {
          rate: item.rate,
          pitch: item.pitch,
          volume: debugDialog.volume,
          format: debugDialog.format,
          text: debugDialog.text,
        },
      });
      ElMessage.success('已保存为该音色的默认参数');
      debugDialog.visible = false;
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败');
    }
  }

  async function onPreview() {
    if (!previewDialog.voice_id || !previewDialog.text) {
      ElMessage.warning('请完善参数');
      return;
    }
    previewDialog.loading = true;
    try {
      const payload: VoicePreviewPayload = {
        voice_id: previewDialog.voice_id,
        text: previewDialog.text,
        model: previewDialog.model,
        format: previewDialog.format,
      };
      if (previewDialog.provider === 'gpt-sovits') {
        payload.text_language = previewDialog.textLanguage;
      }
      const res = await voiceApi.preview(payload);
      const url = res?.data?.data?.url || res?.data?.url;
      if (!url) throw new Error('未返回音频URL');
      previewDialog.url = url;
      ElMessage.success('试听生成成功');
    } catch (e: any) {
      ElMessage.error(e?.message || '试听失败');
    } finally {
      previewDialog.loading = false;
    }
  }

  // 设置名称对话框 state 与提交
  const setNameDialog = reactive<{
    visible: boolean;
    voice_id: string;
    name: string;
    saving: boolean;
  }>({
    visible: false,
    voice_id: '',
    name: '',
    saving: false,
  });
  async function onConfirmSetName() {
    const name = String(setNameDialog.name || '').trim();
    if (!name) {
      ElMessage.warning('请输入名称');
      return;
    }
    setNameDialog.saving = true;
    try {
      await voiceApi.setMeta({ voice_id: setNameDialog.voice_id, meta: { name } });
      const it = voices.value.find((v: any) => (v.voice_id || v.id) === setNameDialog.voice_id);
      if (it) it.name = name;
      ElMessage.success('已更新名称');
      setNameDialog.visible = false;
    } catch (e: any) {
      ElMessage.error(e?.message || '更新失败');
    } finally {
      setNameDialog.saving = false;
    }
  }

  // 单独设置参数对话框 state 与提交
  const paramDialog = reactive<{
    visible: boolean;
    voice_id: string;
    provider?: string;
    text: string;
    format: 'mp3' | 'wav';
    volume: number;
    rate: number;
    pitch: number;
    topK?: number;
    topP?: number;
    temperature?: number;
    speed?: number;
    sampleSteps?: number;
    textLanguage?: string;
    promptLanguage?: string;
    cutPunc?: string;
    url?: string;
    previewing: boolean;
    saving: boolean;
  }>({
    visible: false,
    voice_id: '',
    provider: undefined,
    text: '',
    format: 'mp3',
    volume: 100,
    rate: 1,
    pitch: 1,
    topK: undefined,
    topP: undefined,
    temperature: undefined,
    speed: undefined,
    sampleSteps: undefined,
    textLanguage: undefined,
    promptLanguage: undefined,
    cutPunc: undefined,
    url: undefined,
    previewing: false,
    saving: false,
  });

  async function openSetParams(row: any) {
    paramDialog.visible = true;
    paramDialog.voice_id = row.voice_id || row.id;
    paramDialog.provider = row.provider || 'dashscope';
    // 读取已保存的参数用于回显
    try {
      const res = await voiceApi.getParams(paramDialog.voice_id);
      const data = (res?.data?.data || res?.data || {}) as any;
      if (data && typeof data === 'object') {
        if (typeof data.text === 'string') paramDialog.text = data.text;
        if (typeof data.format === 'string') paramDialog.format = data.format;
        if (typeof data.volume === 'number') paramDialog.volume = data.volume;
        if (typeof data.rate === 'number') paramDialog.rate = data.rate;
        if (typeof data.pitch === 'number') paramDialog.pitch = data.pitch;
        // 回显 GPT-SoVITS 模型参数
        if (typeof data.topK === 'number') paramDialog.topK = data.topK;
        if (typeof data.topP === 'number') paramDialog.topP = data.topP;
        if (typeof data.temperature === 'number') paramDialog.temperature = data.temperature;
        if (typeof data.speed === 'number') paramDialog.speed = data.speed;
        if (typeof data.sampleSteps === 'number') paramDialog.sampleSteps = data.sampleSteps;
        if (typeof data.textLanguage === 'string') paramDialog.textLanguage = data.textLanguage;
        if (typeof data.promptLanguage === 'string')
          paramDialog.promptLanguage = data.promptLanguage;
        if (typeof data.cutPunc === 'string') paramDialog.cutPunc = data.cutPunc;
      }
    } catch {}
  }

  async function onConfirmSetParams() {
    if (!paramDialog.voice_id) return;
    paramDialog.saving = true;
    try {
      const params: any = {
        text: paramDialog.text,
        format: paramDialog.format,
      };

      // 根据 provider 类型保存不同的参数
      if (paramDialog.provider === 'gpt-sovits') {
        // GPT-SoVITS 模型参数
        if (paramDialog.topK !== undefined) params.topK = paramDialog.topK;
        if (paramDialog.topP !== undefined) params.topP = paramDialog.topP;
        if (paramDialog.temperature !== undefined) params.temperature = paramDialog.temperature;
        if (paramDialog.speed !== undefined) params.speed = paramDialog.speed;
        if (paramDialog.sampleSteps !== undefined) params.sampleSteps = paramDialog.sampleSteps;
        if (paramDialog.textLanguage) params.textLanguage = paramDialog.textLanguage;
        if (paramDialog.promptLanguage) params.promptLanguage = paramDialog.promptLanguage;
        if (paramDialog.cutPunc) params.cutPunc = paramDialog.cutPunc;
      } else {
        // DashScope 参数
        params.volume = paramDialog.volume;
        params.rate = paramDialog.rate;
        params.pitch = paramDialog.pitch;
      }

      await voiceApi.setParams({
        voice_id: paramDialog.voice_id,
        params,
      });
      ElMessage.success('已保存默认参数');
      paramDialog.visible = false;
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败');
    } finally {
      paramDialog.saving = false;
    }
  }

  async function onParamPreview() {
    if (!paramDialog.voice_id || !paramDialog.text) {
      ElMessage.warning('请完善参数');
      return;
    }
    paramDialog.previewing = true;
    try {
      const res = await voiceApi.preview({
        voice_id: paramDialog.voice_id,
        text: paramDialog.text,
        model: deriveModelFromVoiceId(paramDialog.voice_id),
        format: paramDialog.format,
        volume: paramDialog.volume,
        rate: paramDialog.rate,
        pitch: paramDialog.pitch,
      });
      const url = res?.data?.data?.url || res?.data?.url;
      if (!url) throw new Error('未返回音频URL');
      paramDialog.url = url;
      ElMessage.success('试听生成成功');
    } catch (e: any) {
      ElMessage.error(e?.message || '试听失败');
    } finally {
      paramDialog.previewing = false;
    }
  }

  function openSetName(row: any) {
    setNameDialog.visible = true;
    setNameDialog.voice_id = row.voice_id || row.id;
    setNameDialog.name = row?.name || '';
  }

  // 自动刷新定时器
  let refreshTimer: number | null = null;

  // 检查是否有PENDING状态的音色
  function hasPendingVoices() {
    return voices.value.some((voice) => voice.status === 'PENDING');
  }

  // 启动自动刷新
  function startAutoRefresh() {
    if (refreshTimer) return;

    refreshTimer = setInterval(() => {
      if (hasPendingVoices()) {
        console.log('检测到PENDING状态音色，自动刷新列表...');
        fetchList();
      }
    }, 10000); // 每10秒检查一次
  }

  // 停止自动刷新
  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  onMounted(() => {
    fetchList();
    fetchCategories();
    startAutoRefresh();
  });

  // 获取分类列表
  async function fetchCategories() {
    try {
      console.log('正在获取分类列表...');
      const res = await voiceCategoryApi.list();
      console.log('分类列表响应:', res);

      // 兼容多种返回格式
      let categoryList = [];
      if (Array.isArray(res?.data?.data)) {
        categoryList = res.data.data;
      } else if (Array.isArray(res?.data)) {
        categoryList = res.data;
      } else if (Array.isArray(res)) {
        categoryList = res;
      }

      categories.value = categoryList;
      console.log('分类列表已更新:', categories.value);
      console.log('分类数量:', categories.value.length);
    } catch (e: any) {
      console.error('获取分类列表失败:', e);
      console.error('错误详情:', e?.response?.data || e?.message);
      categories.value = [];
      // 如果是404或500错误，提示用户可能需要运行数据库迁移
      if (e?.response?.status === 404 || e?.response?.status === 500) {
        ElMessage.warning('分类功能暂不可用，请联系管理员检查数据库配置');
      }
    }
  }

  // 直接在列表中修改分类
  async function onCategoryChange(row: any) {
    try {
      await voiceApi.setCategory({
        voice_id: row.voice_id || row.id,
        categoryId: row.categoryId,
      });
      ElMessage.success('已更新分类');
    } catch (e: any) {
      ElMessage.error(e?.message || '更新失败');
      // 如果失败，恢复原来的值
      await fetchList();
    }
  }

  // 分类管理对话框 state
  const categoryManageDialog = reactive<{
    visible: boolean;
    loading: boolean;
  }>({
    visible: false,
    loading: false,
  });

  function openCategoryManage() {
    categoryManageDialog.visible = true;
    fetchCategories();
  }

  // 添加/编辑分类对话框 state
  const categoryEditDialog = reactive<{
    visible: boolean;
    isEdit: boolean;
    id?: number;
    name: string;
    description: string;
    sort: number;
    isEnabled: boolean;
    saving: boolean;
  }>({
    visible: false,
    isEdit: false,
    name: '',
    description: '',
    sort: 0,
    isEnabled: true,
    saving: false,
  });

  function openAddCategory() {
    categoryEditDialog.visible = true;
    categoryEditDialog.isEdit = false;
    categoryEditDialog.id = undefined;
    categoryEditDialog.name = '';
    categoryEditDialog.description = '';
    categoryEditDialog.sort = 0;
    categoryEditDialog.isEnabled = true;
  }

  function openEditCategory(row: any) {
    categoryEditDialog.visible = true;
    categoryEditDialog.isEdit = true;
    categoryEditDialog.id = row.id;
    categoryEditDialog.name = row.name || '';
    categoryEditDialog.description = row.description || '';
    categoryEditDialog.sort = row.sort || 0;
    categoryEditDialog.isEnabled = row.isEnabled ?? true;
  }

  async function onSaveCategory() {
    const name = String(categoryEditDialog.name || '').trim();
    if (!name) {
      ElMessage.warning('请输入分类名称');
      return;
    }
    categoryEditDialog.saving = true;
    try {
      const data = {
        name,
        description: categoryEditDialog.description,
        sort: categoryEditDialog.sort,
        isEnabled: categoryEditDialog.isEnabled,
      };

      if (categoryEditDialog.isEdit && categoryEditDialog.id) {
        await voiceCategoryApi.update(categoryEditDialog.id, data);
        ElMessage.success('已更新分类');
      } else {
        await voiceCategoryApi.create(data);
        ElMessage.success('已添加分类');
      }

      categoryEditDialog.visible = false;
      await fetchCategories();
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败');
    } finally {
      categoryEditDialog.saving = false;
    }
  }

  async function onRemoveCategory(row: any) {
    try {
      await voiceCategoryApi.remove(row.id);
      ElMessage.success('已删除分类');
      await fetchCategories();
    } catch (e: any) {
      ElMessage.error(e?.message || '删除失败');
    }
  }

  // 手动同步PENDING状态
  async function syncPendingStatus() {
    try {
      syncing.value = true;
      await voiceApi.syncPendingStatus();
      ElMessage.success('PENDING状态同步完成');
      // 同步后刷新列表
      await fetchList();
    } catch (error) {
      console.error('同步PENDING状态失败:', error);
      ElMessage.error('同步失败，请稍后重试');
    } finally {
      syncing.value = false;
    }
  }

  // 刷新：先同步状态，再刷新列表
  async function onRefresh() {
    try {
      syncing.value = true;
      await voiceApi.syncPendingStatus();
    } catch (_) {
      // ignore errors
    } finally {
      syncing.value = false;
    }
    await fetchList();
  }

  onUnmounted(() => {
    stopAutoRefresh();
  });
</script>

<style scoped>
  .mb-2 {
    margin-bottom: 8px;
  }
  .mb-3 {
    margin-bottom: 12px;
  }
  .mb-4 {
    margin-bottom: 16px;
  }

  .ml-2 {
    margin-left: 8px;
  }
  .inline-block {
    display: inline-block;
  }
  .p-4 {
    padding: 16px;
  }
  .text-gray-500 {
    color: #6b7280;
  }
  .text-xs {
    font-size: 12px;
  }
  .flex {
    display: flex;
  }
  .items-center {
    align-items: center;
  }
  .justify-between {
    justify-content: space-between;
  }
  .gap-2 {
    gap: 8px;
  }
  .w-full {
    width: 100%;
  }
</style>

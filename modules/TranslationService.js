class TranslationService {
    constructor() {
        this.isRunning = false;
        this.translationQueue = [];
        this.processingQueue = false;
        this.config = {
            targetLang: 'zh-CN',
            retryAttempts: 3,
            retryDelay: 1000,
            cacheExpiration: 7 * 24 * 60 * 60 * 1000, // 7天
            cacheKey: 'whatsapp_translations',
            translationHistoryKey: 'whatsapp_translation_history'
        };
        
        // 初始化缓存
        this.cache = null;
        this.translationHistory = null;
        this.initCache();
        this.initTranslationHistory();
    }

    // 初始化缓存
    initCache() {
        try {
            const stored = localStorage.getItem(this.config.cacheKey);
            this.cache = stored ? JSON.parse(stored) : {};
            this.cleanExpiredCache();
        } catch (error) {
            console.error('TranslationService: 初始化缓存失败:', error);
            this.cache = {};
        }
    }

    // 获取缓存的翻译
    getCachedTranslation(text) {
        if (!this.cache) this.initCache();
        const item = this.cache[text];
        if (item && item.timestamp > Date.now() - this.config.cacheExpiration) {
            console.log('TranslationService: 使用缓存的翻译');
            return item.translation;
        }
        return null;
    }

    // 设置缓存
    setCachedTranslation(text, translation) {
        if (!this.cache) this.initCache();
        this.cache[text] = {
            translation,
            timestamp: Date.now()
        };
        this.saveCache();
    }

    // 清理过期缓存
    cleanExpiredCache() {
        const now = Date.now();
        let changed = false;
        for (const key in this.cache) {
            if (this.cache[key].timestamp <= now - this.config.cacheExpiration) {
                delete this.cache[key];
                changed = true;
            }
        }
        if (changed) this.saveCache();
    }

    // 保存缓存到localStorage
    saveCache() {
        try {
            localStorage.setItem(this.config.cacheKey, JSON.stringify(this.cache));
        } catch (error) {
            console.error('TranslationService: 保存缓存失败:', error);
        }
    }

    // 初始化翻译历史记录
    initTranslationHistory() {
        try {
            const stored = localStorage.getItem(this.config.translationHistoryKey);
            this.translationHistory = stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('TranslationService: 初始化翻译历史失败:', error);
            this.translationHistory = {};
        }
    }

    // 保存翻译历史记录
    saveTranslationHistory() {
        try {
            localStorage.setItem(this.config.translationHistoryKey, JSON.stringify(this.translationHistory));
        } catch (error) {
            console.error('TranslationService: 保存翻译历史失败:', error);
        }
    }

    // 记录翻译历史
    recordTranslation(originalText, translatedText, messageId) {
        if (!this.translationHistory) this.initTranslationHistory();
        
        this.translationHistory[messageId] = {
            originalText,
            translatedText,
            timestamp: Date.now()
        };
        this.saveTranslationHistory();
    }

    // 获取翻译历史
    getTranslationHistory(messageId) {
        if (!this.translationHistory) this.initTranslationHistory();
        return this.translationHistory[messageId] || null;
    }

    // 使用Google Translate API翻译文本
    async translateText(text) {
        // 先检查缓存
        const cached = this.getCachedTranslation(text);
        if (cached) {
            return cached;
        }

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${this.config.targetLang}&dt=t&q=${encodeURIComponent(text)}`;

        return new Promise((resolve, reject) => {
            // 使用fetch API（Chrome扩展中可用）
            fetch(url, {
                method: 'GET',
                timeout: 10000
            })
            .then(response => response.json())
            .then(data => {
                const translatedText = data[0]
                    .map(item => item[0])
                    .filter(Boolean)
                    .join('');
                
                // 保存到缓存
                this.setCachedTranslation(text, translatedText);
                
                resolve(translatedText);
            })
            .catch(error => {
                console.error('TranslationService: 翻译请求失败:', error);
                reject(error);
            });
        });
    }

    // 翻译消息
    async translateMessage(messageInfo) {
        if (!messageInfo || !messageInfo.text) {
            console.log('TranslationService: 无效的消息信息');
            return null;
        }

        const originalText = messageInfo.text.trim();
        if (!originalText) {
            console.log('TranslationService: 消息文本为空');
            return null;
        }

        // 先检查翻译历史
        const historyRecord = this.getTranslationHistory(messageInfo.id);
        if (historyRecord) {
            console.log('TranslationService: 使用历史翻译记录');
            return {
                originalText: historyRecord.originalText,
                translatedText: historyRecord.translatedText,
                messageId: messageInfo.id,
                timestamp: historyRecord.timestamp
            };
        }

        try {
            const translatedText = await this.translateText(originalText);
            if (translatedText && translatedText !== originalText) {
                // 记录翻译历史
                this.recordTranslation(originalText, translatedText, messageInfo.id);
                
                return {
                    originalText,
                    translatedText,
                    messageId: messageInfo.id,
                    timestamp: Date.now()
                };
            } else {
                console.log('TranslationService: 翻译结果为空或相同');
                return null;
            }
        } catch (error) {
            console.error('TranslationService: 翻译错误:', error);
            return null;
        }
    }

    // 显示翻译结果
    displayTranslation(messageElement, translationResult) {
        if (!messageElement || !translationResult) return;

        // 检查是否已经有翻译显示
        const existingTranslation = messageElement.querySelector('.whatsapp-translation-result');
        if (existingTranslation) {
            existingTranslation.remove();
        }

        const translationDiv = document.createElement('div');
        translationDiv.className = 'whatsapp-translation-result';
        translationDiv.style.cssText = `
            color: #00e676;
            font-size: 1.3em;
            font-weight: 500;
            margin-top: 8px;
            padding: 6px 10px;
            background-color: rgba(0, 230, 118, 0.1);
            border-radius: 8px;
            border-left: 3px solid #00e676;
            opacity: 1 !important;
            position: relative;
            z-index: 1000;
        `;
        translationDiv.textContent = `🔄 ${translationResult.translatedText}`;

        // 查找合适的插入位置
        const textSelectors = [
            'div.copyable-text span[dir="ltr"]',
            '[data-testid="msg-text"]',
            '.message-text'
        ];

        let insertTarget = null;
        for (const selector of textSelectors) {
            const textElement = messageElement.querySelector(selector);
            if (textElement) {
                insertTarget = textElement.closest('.copyable-text')?.parentElement || textElement.parentElement;
                break;
            }
        }

        if (insertTarget) {
            insertTarget.appendChild(translationDiv);
            // 标记消息为已翻译
            messageElement.setAttribute('data-translated', 'true');
            console.log('TranslationService: 翻译结果显示成功');
        } else {
            console.error('TranslationService: 找不到翻译插入位置');
        }
    }

    // 添加翻译到队列
    addToQueue(messageInfo) {
        this.translationQueue.push(messageInfo);
        console.log(`TranslationService: 添加到翻译队列，当前队列长度: ${this.translationQueue.length}`);
        
        if (!this.processingQueue) {
            this.processQueue();
        }
    }

    // 添加高优先级翻译（用于当前聊天的新消息）
    addHighPriorityToQueue(messageInfo) {
        // 将高优先级消息插入到队列前面
        this.translationQueue.unshift(messageInfo);
        console.log(`TranslationService: 添加高优先级翻译，当前队列长度: ${this.translationQueue.length}`);
        
        if (!this.processingQueue) {
            this.processQueue();
        }
    }

    // 清空翻译队列（用于聊天切换时）
    clearQueue() {
        const queueLength = this.translationQueue.length;
        this.translationQueue = [];
        console.log(`TranslationService: 清空翻译队列，移除了 ${queueLength} 个待翻译任务`);
    }

    // 暂停队列处理
    pauseQueue() {
        this.processingQueue = true; // 阻止新的处理开始
        console.log('TranslationService: 翻译队列已暂停');
    }

    // 恢复队列处理
    resumeQueue() {
        this.processingQueue = false;
        if (this.translationQueue.length > 0) {
            this.processQueue();
        }
        console.log('TranslationService: 翻译队列已恢复');
    }

    // 处理翻译队列（多线程版本）
    async processQueue() {
        if (this.processingQueue || this.translationQueue.length === 0) {
            return;
        }

        this.processingQueue = true;
        console.log(`TranslationService: 开始处理翻译队列，共 ${this.translationQueue.length} 条消息`);

        // 创建多个并发任务
        const concurrentTasks = 3; // 同时处理3个翻译任务
        const tasks = [];

        while (this.translationQueue.length > 0) {
            const batch = this.translationQueue.splice(0, concurrentTasks);
            
            // 为每个批次创建并发任务
            const batchPromises = batch.map(async (messageInfo) => {
                try {
                    const translationResult = await this.translateMessage(messageInfo);
                    if (translationResult) {
                        this.displayTranslation(messageInfo.element, translationResult);
                    }
                } catch (error) {
                    console.error('TranslationService: 翻译任务错误:', error);
                }
            });

            // 等待当前批次完成
            await Promise.all(batchPromises);
            
            // 短暂延迟避免请求过于频繁
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        this.processingQueue = false;
        console.log('TranslationService: 翻译队列处理完成');
    }

    // 设置消息回调
    setMessageCallback(callback) {
        this.messageCallback = callback;
    }

    // 处理新消息（由MessageService调用）
    handleNewMessage(messageInfo) {
        console.log('TranslationService: 收到新消息', messageInfo);
        // 使用高优先级队列，确保当前聊天的新消息优先翻译
        this.addHighPriorityToQueue(messageInfo);
    }

    // 启动服务
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('TranslationService: 翻译服务已启动');
    }

    // 停止服务
    stop() {
        this.isRunning = false;
        this.translationQueue = [];
        this.processingQueue = false;
        console.log('TranslationService: 翻译服务已停止');
    }

    // 获取服务状态
    getStatus() {
        return {
            isRunning: this.isRunning,
            queueLength: this.translationQueue.length,
            isProcessingQueue: this.processingQueue,
            cacheSize: Object.keys(this.cache || {}).length
        };
    }

    // 清理所有翻译显示
    clearAllTranslations() {
        const translations = document.querySelectorAll('.whatsapp-translation-result');
        translations.forEach(translation => translation.remove());
        console.log(`TranslationService: 清理了 ${translations.length} 个翻译显示`);
    }

    // 重新应用所有翻译（用于聊天切换后恢复翻译显示）
    async reapplyAllTranslations() {
        if (!this.isRunning) return;

        console.log('TranslationService: 重新应用所有翻译...');
        
        // 获取所有已翻译但未显示的消息
        const translatedMessages = document.querySelectorAll('[data-translated="true"]:not(:has(.whatsapp-translation-result))');
        
        // 批量处理，提高效率
        const batchSize = 10;
        for (let i = 0; i < translatedMessages.length; i += batchSize) {
            const batch = Array.from(translatedMessages).slice(i, i + batchSize);
            
            // 并发处理批次
            const promises = batch.map(async (messageElement) => {
                // 提取消息文本
                const textSelectors = [
                    'div.copyable-text span[dir="ltr"]',
                    '[data-testid="msg-text"]',
                    '.message-text'
                ];

                let text = null;
                for (const selector of textSelectors) {
                    const textElement = messageElement.querySelector(selector);
                    if (textElement) {
                        text = textElement.textContent.trim();
                        break;
                    }
                }

                if (text) {
                    // 生成消息ID
                    const messageId = this.generateMessageId(text);
                    
                    // 检查翻译历史
                    const historyRecord = this.getTranslationHistory(messageId);
                    if (historyRecord) {
                        // 重新显示翻译
                        this.displayTranslation(messageElement, {
                            originalText: historyRecord.originalText,
                            translatedText: historyRecord.translatedText,
                            messageId: messageId,
                            timestamp: historyRecord.timestamp
                        });
                    }
                }
            });
            
            // 等待当前批次完成
            await Promise.all(promises);
            
            // 短暂延迟，避免阻塞UI
            if (i + batchSize < translatedMessages.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        console.log(`TranslationService: 重新应用了 ${translatedMessages.length} 个翻译`);
    }

    // 生成消息ID（与MessageService保持一致）
    generateMessageId(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return `msg_${Math.abs(hash)}_${Date.now()}`;
    }

    // 清理缓存
    clearCache() {
        this.cache = {};
        localStorage.removeItem(this.config.cacheKey);
        console.log('TranslationService: 缓存已清理');
    }

    // 获取缓存统计
    getCacheStats() {
        if (!this.cache) return { size: 0, keys: [] };
        
        const keys = Object.keys(this.cache);
        const now = Date.now();
        const expired = keys.filter(key => 
            this.cache[key].timestamp <= now - this.config.cacheExpiration
        );
        
        return {
            size: keys.length,
            keys: keys,
            expired: expired.length,
            valid: keys.length - expired.length
        };
    }
}

// 导出到全局作用域
window.TranslationService = TranslationService; 
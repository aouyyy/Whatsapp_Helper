// == WhatsApp 选择模式模块 ==
class SelectionMode {
    constructor() {
        this.selectMode = false;
        this.selectedMsgSet = new Set();
        this.msgDataList = [];
        this.phoneNumber = '';
        this.lastPhone = '';
        this.phoneObserver = null;
        this.db = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            await this.initDB();
            this.isInitialized = true;
            console.log('选择模式模块初始化完成');
        } catch (error) {
            console.error('选择模式模块初始化失败:', error);
        }
    }

    // 初始化IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('WhatsAppSelectionDB', 1);
            
            request.onerror = () => {
                console.error('IndexedDB打开失败:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB连接成功');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('messages')) {
                    const store = db.createObjectStore('messages', { keyPath: 'phone' });
                    store.createIndex('phone', 'phone', { unique: true });
                    console.log('IndexedDB对象存储创建成功');
                }
            };
        });
    }

    // 获取手机号
    getPhoneNumber() {
        console.log('=== getPhoneNumber 开始 ===');
        try {
            let allContactElements = [];
            
            // 查找header中的span元素
            const headerSpans = document.querySelectorAll('header span');
            Array.from(headerSpans).forEach(span => {
                const text = span.textContent.trim();
                if (!text || text.length === 0 || text.length > 100) return;
                
                const rect = span.getBoundingClientRect();
                const isInHeaderArea = rect.top < 100 && rect.left > 100;
                
                if (isInHeaderArea) {
                    allContactElements.push({ element: span, text: text, type: 'span' });
                }
            });
            
            // 查找header中的div元素
            const headerDivs = document.querySelectorAll('header div');
            Array.from(headerDivs).forEach(div => {
                const text = div.textContent.trim();
                if (!text || text.length === 0 || text.length > 100) return;
                
                const rect = div.getBoundingClientRect();
                const isInHeaderArea = rect.top < 100 && rect.left > 100;
                
                if (isInHeaderArea) {
                    allContactElements.push({ element: div, text: text, type: 'div' });
                }
            });
            
            // 按优先级排序
            let bestContact = null;
            let bestScore = -1;
            
            allContactElements.forEach(({ element, text, type }) => {
                let score = 0;
                let contactType = '';
                
                // 1. 全球手机号 (最高优先级)
                const cleanText = text.replace(/[^\d+]/g, '');
                const globalPhonePatterns = [
                    /^\+?\d{10,15}$/,
                    /^\d{10,15}$/,
                ];
                
                for (let pattern of globalPhonePatterns) {
                    if (pattern.test(cleanText)) {
                        score = 1000;
                        contactType = 'global_phone';
                        break;
                    }
                }
                
                // 2. 纯数字 (次高优先级)
                if (score === 0 && /^\d+$/.test(text)) {
                    score = 800;
                    contactType = 'pure_number';
                }
                
                // 3. 纯中文 (中等优先级)
                if (score === 0 && /^[\u4e00-\u9fa5]{2,50}$/.test(text)) {
                    score = 600;
                    contactType = 'chinese';
                }
                
                // 4. 纯英文 (较低优先级)
                if (score === 0 && /^[a-zA-Z\s\-_\.]{2,50}$/.test(text)) {
                    score = 400;
                    contactType = 'english';
                }
                
                // 5. 中英文混合包含数字 (最低优先级)
                if (score === 0 && /[\u4e00-\u9fa5]/.test(text) && /[a-zA-Z]/.test(text) && /\d/.test(text)) {
                    score = 200;
                    contactType = 'mixed_with_number';
                }
                
                // 6. 其他混合类型
                if (score === 0 && (/[\u4e00-\u9fa5]/.test(text) || /[a-zA-Z]/.test(text) || /\d/.test(text))) {
                    score = 100;
                    contactType = 'mixed';
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    bestContact = { element, text, type, contactType };
                }
            });
            
            if (bestContact && bestScore > 0) {
                this.phoneNumber = bestContact.text;
                console.log(`选择最佳联系人: "${bestContact.text}" (类型: ${bestContact.contactType}, 分数: ${bestScore})`);
            } else {
                console.log('未找到合适的联系人元素');
                this.phoneNumber = '';
            }
        } catch (e) { 
            console.error('getPhoneNumber出错:', e);
            this.phoneNumber = ''; 
        }
        console.log('=== getPhoneNumber 结束，phoneNumber:', this.phoneNumber);
    }

    // 获取所有消息
    getAllMessages() {
        console.log('=== getAllMessages 开始 ===');
        
        let allMessages = [];
        const messageNodes = document.querySelectorAll('.message-in');
        console.log(`通过 class 'message-in' 找到 ${messageNodes.length} 个消息节点`);

        Array.from(messageNodes).forEach((node, idx) => {
            let text = '';
            const textSpan = node.querySelector('.selectable-text.copyable-text');
            if (textSpan) {
                text = textSpan.textContent.trim();
            } else {
                text = node.textContent.trim();
            }

            let imgUrl = '';
            let imgData = [];
            const img = node.querySelector('img[src^="blob:"]');
            if (img) {
                imgUrl = img.src;
            }

            let type = 'text';
            if (imgUrl && text) {
                type = 'mixed';
            } else if (imgUrl) {
                type = 'image';
            }

            allMessages.push({
                idx: allMessages.length,
                node: node,
                text: text,
                imgUrl: imgUrl,
                imgData: imgData,
                type: type
            });
        });

        // 去重并排序
        const uniqueMessages = [];
        const processedNodes = new Set();
        allMessages.forEach(msg => {
            if (!processedNodes.has(msg.node)) {
                processedNodes.add(msg.node);
                uniqueMessages.push(msg);
            }
        });
        
        uniqueMessages.sort((a, b) => {
            const aRect = a.node.getBoundingClientRect();
            const bRect = b.node.getBoundingClientRect();
            return aRect.top - bRect.top;
        });
        
        this.msgDataList = uniqueMessages.map((msg, idx) => ({
            ...msg,
            idx: idx
        }));
        
        console.log(`最终找到 ${this.msgDataList.length} 个有效消息`);
        console.log('=== getAllMessages 结束 ===');
    }

    // 渲染选择按钮
    renderSelectButtons() {
        console.log('=== renderSelectButtons 开始 ===');
        
        // 清除之前的按钮
        document.querySelectorAll('.wa-msg-select-btn').forEach(btn => btn.remove());
        
        this.msgDataList.forEach(({ idx, node, type }) => {
            console.log(`为消息 ${idx} (${type}) 添加选择按钮`);
            
            node.classList.add('wa-msg-selectable');
            
            const btn = document.createElement('button');
            btn.textContent = this.selectedMsgSet.has(idx) ? '✓' : '选';
            btn.className = 'wa-msg-select-btn';
            btn.dataset.idx = idx;
            btn.dataset.type = type;
            
            btn.style.cssText = `
                position: absolute !important;
                right: -40px !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                background: #25D366 !important;
                color: #fff !important;
                border: none !important;
                border-radius: 50% !important;
                width: 28px !important;
                height: 28px !important;
                cursor: pointer !important;
                font-weight: bold !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
                z-index: 9999 !important;
                transition: all 0.3s ease !important;
                font-size: 12px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                opacity: 0 !important;
                pointer-events: none !important;
                line-height: 1 !important;
                padding: 0 !important;
                margin: 0 !important;
                min-width: 28px !important;
                min-height: 28px !important;
                max-width: 28px !important;
                max-height: 28px !important;
            `;
            
            btn.onmouseenter = () => {
                btn.style.background = '#128C7E';
                btn.style.transform = 'translateY(-50%) scale(1.1)';
            };
            btn.onmouseleave = () => {
                btn.style.background = '#25D366';
                btn.style.transform = 'translateY(-50%) scale(1)';
            };
            btn.onclick = async (e) => {
                e.stopPropagation();
                await this.toggleMsgSelect(idx, node, btn);
            };
            
            node.style.position = 'relative';
            node.style.marginRight = '35px';
            node.appendChild(btn);
            
            if (this.selectedMsgSet.has(idx)) {
                node.classList.add('wa-msg-selected');
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            } else {
                node.classList.remove('wa-msg-selected');
            }
            
            node.onmouseenter = (e) => {
                if (e.target.classList.contains('wa-msg-select-btn')) return;
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            };
            
            node.onmouseleave = (e) => {
                if (e.target.classList.contains('wa-msg-select-btn')) return;
                if (!this.selectedMsgSet.has(idx)) {
                    btn.style.opacity = '0';
                    btn.style.pointerEvents = 'none';
                }
            };
            
            node.onclick = async (e) => {
                if (e.target.classList.contains('wa-msg-select-btn')) return;
                await this.toggleMsgSelect(idx, node, btn);
            };
        });
        
        console.log('=== renderSelectButtons 结束 ===');
    }

    // 切换消息选择
    async toggleMsgSelect(idx, node, btn) {
        console.log('=== toggleMsgSelect 开始 ===');
        console.log('选择消息索引:', idx);
        console.log('当前selectedMsgSet:', Array.from(this.selectedMsgSet));
        console.log('消息数据:', this.msgDataList[idx]);
        
        if (this.selectedMsgSet.has(idx)) {
            console.log('取消选择消息:', idx);
            this.selectedMsgSet.delete(idx);
            node.classList.remove('wa-msg-selected');
            if (btn) {
                btn.textContent = '选';
                btn.style.opacity = '0';
                btn.style.pointerEvents = 'none';
            }
        } else {
            console.log('选择消息:', idx);
            this.selectedMsgSet.add(idx);
            node.classList.add('wa-msg-selected');
            if (btn) {
                btn.textContent = '✓';
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
            
            // 选择消息时立即下载图片
            const msgData = this.msgDataList[idx];
            console.log('消息数据详情:', msgData);
            
            if (msgData.imgUrl) {
                console.log('发现图片，开始下载:', msgData.imgUrl);
                // 显示下载提示
                const downloadTip = document.createElement('div');
                downloadTip.style.cssText = `
                    position: fixed; z-index: 100000; top: 20px; right: 20px;
                    background: #17a2b8; color: #fff; padding: 8px 12px; border-radius: 4px;
                    font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                `;
                downloadTip.textContent = '正在下载图片...';
                document.body.appendChild(downloadTip);
                
                // 下载图片
                this.downloadImageToBase64(msgData.imgUrl, idx).then(async (imgData) => {
                    console.log('图片下载完成:', imgData);
                    msgData.imgData = [imgData];
                    downloadTip.textContent = '图片下载完成';
                    downloadTip.style.background = '#28a745';
                    setTimeout(() => downloadTip.remove(), 2000);
                    
                    // 图片下载完成后立即保存到IndexedDB
                    console.log('图片下载完成，准备保存到IndexedDB');
                    await this.saveSelectedToLocal();
                    console.log('图片下载完成，已保存到IndexedDB');
                }).catch(error => {
                    console.error('下载图片失败:', error);
                    downloadTip.textContent = '图片下载失败';
                    downloadTip.style.background = '#dc3545';
                    setTimeout(() => downloadTip.remove(), 2000);
                });
            } else {
                console.log('消息没有图片，直接保存');
                // 没有图片的消息也要保存到IndexedDB
                await this.saveSelectedToLocal();
                console.log('消息已选择，已保存到IndexedDB');
            }
        }
        console.log('=== toggleMsgSelect 结束 ===');
    }

    // 保存选中消息到IndexedDB
    async saveSelectedToLocal() {
        console.log('=== saveSelectedToLocal 开始 ===');
        
        if (!this.phoneNumber || this.selectedMsgSet.size === 0) {
            console.log('保存条件不满足，退出保存');
            return;
        }
        
        try {
            if (!this.db) {
                await this.initDB();
            }
            
            const selectedArr = Array.from(this.selectedMsgSet).map(idx => {
                const { text, node, imgData } = this.msgDataList[idx];
                console.log(`处理消息 ${idx}:`, { 
                    text: text.substring(0, 50) + '...', 
                    imgDataLength: imgData ? imgData.length : 0,
                    imgData: imgData 
                });
                return { text, img: imgData || [] };
            });
            
            const transaction = this.db.transaction(['messages'], 'readwrite');
            const store = transaction.objectStore('messages');
            
            const data = {
                phone: this.phoneNumber,
                messages: selectedArr,
                lastUpdated: new Date().toISOString()
            };
            
            const request = store.put(data);
            
            request.onsuccess = () => {
                console.log('IndexedDB保存成功');
            };
            
            request.onerror = () => {
                console.error('IndexedDB保存失败:', request.error);
            };
            
        } catch (error) {
            console.error('保存到IndexedDB时出错:', error);
        }
        
        console.log('=== saveSelectedToLocal 结束 ===');
    }

    // 从IndexedDB加载消息
    async loadMessagesFromDB(phone) {
        try {
            if (!this.db) {
                await this.initDB();
            }
            
            const transaction = this.db.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const request = store.get(phone);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    console.log(`从IndexedDB加载手机号 ${phone} 的数据:`, result);
                    resolve(result ? result.messages : []);
                };
                
                request.onerror = () => {
                    console.error('从IndexedDB读取失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('加载IndexedDB数据时出错:', error);
            return [];
        }
    }

    // 从IndexedDB加载所有消息
    async loadAllMessagesFromDB() {
        try {
            if (!this.db) {
                await this.initDB();
            }
            
            const transaction = this.db.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const results = request.result;
                    console.log('从IndexedDB加载所有数据:', results);
                    
                    const allData = {};
                    results.forEach(item => {
                        allData[item.phone] = item.messages;
                    });
                    
                    resolve(allData);
                };
                
                request.onerror = () => {
                    console.error('从IndexedDB读取所有数据失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('加载所有IndexedDB数据时出错:', error);
            return {};
        }
    }

    // 清空IndexedDB中的所有数据
    async clearAllDataFromDB() {
        try {
            if (!this.db) {
                await this.initDB();
            }
            
            const transaction = this.db.transaction(['messages'], 'readwrite');
            const store = transaction.objectStore('messages');
            const request = store.clear();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('IndexedDB数据清空成功');
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('清空IndexedDB失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('清空IndexedDB时出错:', error);
            throw error;
        }
    }

    // 将blob转换为base64
    blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    // 获取图片扩展名
    getImageExtension(mimeType) {
        const map = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp'
        };
        return map[mimeType] || 'jpg';
    }

    // 下载图片并转换为base64
    async downloadImageToBase64(blobUrl, idx) {
        try {
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            const base64 = await this.blobToBase64(blob);
            
            return {
                filename: `img_${Date.now()}_${idx}.${this.getImageExtension(blob.type)}`,
                data: base64
            };
        } catch (error) {
            console.error('下载图片失败:', error);
            return {
                filename: `img_${Date.now()}_${idx}.jpg`,
                data: null,
                error: '下载失败'
            };
        }
    }

    // 清除选择UI
    clearSelectUI() {
        this.selectedMsgSet.clear();
        this.clearSelectUIOnly();
    }

    clearSelectUIOnly() {
        document.querySelectorAll('.wa-msg-select-btn').forEach(btn => btn.remove());
        document.querySelectorAll('.wa-msg-selected').forEach(el => el.classList.remove('wa-msg-selected'));
        document.querySelectorAll('.wa-msg-selectable').forEach(el => {
            el.classList.remove('wa-msg-selectable');
            el.style.position = '';
            el.style.marginRight = '';
            el.onclick = null;
            el.onmouseenter = null;
            el.onmouseleave = null;
        });
    }

    // 添加选中样式
    addSelectedStyle() {
        const styleId = 'wa-msg-selected-style';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .wa-msg-selected { 
                box-shadow: 0 0 0 3px #25D366 !important; 
                border-radius: 8px !important; 
            }
            .wa-msg-selectable:hover { 
                background: #f0fff4 !important; 
                cursor: pointer; 
            }
            .wa-msg-select-btn { 
                outline: none; 
            }
        `;
        document.head.appendChild(style);
    }

    // 获取手机号和消息
    async getPhoneAndMessages() {
        if (this.selectMode && this.phoneNumber) {
            await this.saveSelectedToLocal();
        }
        
        this.getPhoneNumber();
        this.lastPhone = this.phoneNumber;
        this.getAllMessages();
        
        // 加载之前保存的数据并恢复选择状态
        if (this.phoneNumber) {
            try {
                const savedMessages = await this.loadMessagesFromDB(this.phoneNumber);
                console.log(`加载手机号 ${this.phoneNumber} 的保存数据:`, savedMessages);
                
                this.selectedMsgSet.clear();
                let restoredCount = 0;
                
                savedMessages.forEach((savedMsg, savedIdx) => {
                    let bestMatch = -1;
                    let bestScore = 0;
                    
                    this.msgDataList.forEach((msg, msgIdx) => {
                        let score = 0;
                        
                        if (msg.text === savedMsg.text) {
                            score += 100;
                        } else if (msg.text.includes(savedMsg.text) || savedMsg.text.includes(msg.text)) {
                            score += 50;
                        }
                        
                        const msgHasImg = msg.imgData && msg.imgData.length > 0;
                        const savedHasImg = savedMsg.img && savedMsg.img.length > 0;
                        if (msgHasImg === savedHasImg) {
                            score += 30;
                        }
                        
                        if (msg.type === savedMsg.type) {
                            score += 20;
                        }
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = msgIdx;
                        }
                    });
                    
                    if (bestMatch !== -1 && bestScore >= 80) {
                        this.selectedMsgSet.add(bestMatch);
                        console.log(`恢复消息选择: ${bestMatch} (匹配度: ${bestScore})`);
                        
                        if (savedMsg.img && savedMsg.img.length > 0) {
                            this.msgDataList[bestMatch].imgData = savedMsg.img;
                        }
                        
                        restoredCount++;
                    }
                });
                
                console.log(`恢复了 ${restoredCount} 个消息的选择状态`);
                
            } catch (error) {
                console.error('加载保存数据时出错:', error);
            }
        }
        
        this.renderSelectButtons();
        this.addSelectedStyle();
    }

    // 监听手机号变化
    observePhoneChange() {
        this.disconnectPhoneObserver();
        
        let allContactElements = [];
        
        const headerSpans = document.querySelectorAll('header span');
        Array.from(headerSpans).forEach(span => {
            const text = span.textContent.trim();
            if (!text || text.length === 0 || text.length > 100) return;
            
            const rect = span.getBoundingClientRect();
            const isInHeaderArea = rect.top < 100 && rect.left > 100;
            
            if (isInHeaderArea) {
                allContactElements.push({ element: span, text: text, type: 'span' });
            }
        });
        
        const headerDivs = document.querySelectorAll('header div');
        Array.from(headerDivs).forEach(div => {
            const text = div.textContent.trim();
            if (!text || text.length === 0 || text.length > 100) return;
            
            const rect = div.getBoundingClientRect();
            const isInHeaderArea = rect.top < 100 && rect.left > 100;
            
            if (isInHeaderArea) {
                allContactElements.push({ element: div, text: text, type: 'div' });
            }
        });
        
        let bestContact = null;
        let bestScore = -1;
        
        allContactElements.forEach(({ element, text, type }) => {
            let score = 0;
            
            const cleanText = text.replace(/[^\d+]/g, '');
            const globalPhonePatterns = [
                /^\+?\d{10,15}$/,
                /^\d{10,15}$/,
            ];
            
            for (let pattern of globalPhonePatterns) {
                if (pattern.test(cleanText)) {
                    score = 1000;
                    break;
                }
            }
            
            if (score === 0 && /^\d+$/.test(text)) {
                score = 800;
            }
            
            if (score === 0 && /^[\u4e00-\u9fa5]{2,50}$/.test(text)) {
                score = 600;
            }
            
            if (score === 0 && /^[a-zA-Z\s\-_\.]{2,50}$/.test(text)) {
                score = 400;
            }
            
            if (score === 0 && /[\u4e00-\u9fa5]/.test(text) && /[a-zA-Z]/.test(text) && /\d/.test(text)) {
                score = 200;
            }
            
            if (score === 0 && (/[\u4e00-\u9fa5]/.test(text) || /[a-zA-Z]/.test(text) || /\d/.test(text))) {
                score = 100;
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestContact = { element, text, type };
            }
        });
        
        if (!bestContact || bestScore === 0) {
            console.log('未找到合适的联系人监听元素');
            return;
        }
        
        console.log(`选择联系人监听元素: "${bestContact.text}"`);
        
        this.phoneObserver = new MutationObserver(async () => {
            this.getPhoneNumber();
            if (this.phoneNumber !== this.lastPhone) {
                console.log(`联系人变化检测: "${this.lastPhone}" -> "${this.phoneNumber}"`);
                await this.saveSelectedToLocal();
                this.clearSelectUI();
                await this.getPhoneAndMessages();
            }
        });
        this.phoneObserver.observe(bestContact.element, { childList: true, characterData: true, subtree: true });
    }

    disconnectPhoneObserver() {
        if (this.phoneObserver) {
            this.phoneObserver.disconnect();
            this.phoneObserver = null;
        }
    }

    // 导出选中消息
    exportSelected() {
        if (this.selectedMsgSet.size === 0) {
            alert('请先选择消息！');
            return;
        }
        const exportData = Array.from(this.selectedMsgSet).map(idx => {
            const { text, imgData } = this.msgDataList[idx];
            return { text, img: imgData || [] };
        });
        const data = {
            phone: this.phoneNumber,
            exportTime: new Date().toISOString(),
            selectedMessages: exportData
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `whatsapp_selected_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // 导出所有联系人消息
    async exportAllContacts() {
        const store = await this.loadAllMessagesFromDB();
        if (Object.keys(store).length === 0) {
            alert('没有已保存的联系人消息！');
            return;
        }
        const data = store;
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `whatsapp_all_contacts_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 1000);
    }

    // 清空所有联系人消息
    async clearAllContacts() {
        if (confirm('确定要清空所有已保存的联系人消息吗？')) {
            await this.clearAllDataFromDB();
            alert('已清空！');
        }
    }

    // 检查IndexedDB内容
    async checkLocalStorage() {
        const store = await this.loadAllMessagesFromDB();
        if (Object.keys(store).length === 0) {
            alert('IndexedDB中没有数据！');
            return;
        }
        
        try {
            const data = store;
            const phoneCount = Object.keys(data).length;
            let totalMessages = 0;
            let totalImages = 0;
            let totalBase64Size = 0;
            
            Object.entries(data).forEach(([phone, messages]) => {
                totalMessages += messages.length;
                messages.forEach(msg => {
                    if (msg.img && msg.img.length > 0) {
                        totalImages += msg.img.length;
                        msg.img.forEach(img => {
                            if (img.data && img.data.startsWith('data:image')) {
                                totalBase64Size += img.data.length;
                            }
                        });
                    }
                });
            });
            
            alert(`IndexedDB数据统计：
联系人数量: ${phoneCount}
消息总数: ${totalMessages}
图片总数: ${totalImages}
Base64数据大小: ${(totalBase64Size / 1024).toFixed(2)} KB
当前手机号: ${this.phoneNumber}
已选消息数: ${this.selectedMsgSet.size}`);
            
            console.log('IndexedDB完整数据:', data);
            
            // 详细检查图片数据
            Object.entries(data).forEach(([phone, messages]) => {
                console.log(`联系人 ${phone} 的图片数据:`, messages.filter(msg => msg.img && msg.img.length > 0));
            });
        } catch (error) {
            alert('IndexedDB数据格式错误！');
            console.error('IndexedDB解析错误:', error);
        }
    }

    // 切换选择模式
    async toggleSelectMode() {
        if (this.selectMode) await this.saveSelectedToLocal();
        this.selectMode = !this.selectMode;
        
        if (this.selectMode) {
            console.log('进入选择模式');
            this.clearSelectUIOnly();
            await this.getPhoneAndMessages();
            this.observePhoneChange();
        } else {
            console.log('退出选择模式');
            this.clearSelectUI();
            this.disconnectPhoneObserver();
        }
        
        return this.selectMode;
    }

    // 获取状态
    getStatus() {
        return {
            selectMode: this.selectMode,
            selectedCount: this.selectedMsgSet.size,
            totalMessages: this.msgDataList.length,
            phoneNumber: this.phoneNumber
        };
    }

    // 停止服务
    stop() {
        this.selectMode = false;
        this.clearSelectUI();
        this.disconnectPhoneObserver();
        console.log('选择模式服务已停止');
    }

    // 测试图片下载功能
    async testImageDownload() {
        console.log('=== 测试图片下载功能 ===');
        
        // 查找页面中的图片
        const images = document.querySelectorAll('img[src^="blob:"]');
        console.log(`找到 ${images.length} 个blob图片`);
        
        if (images.length === 0) {
            alert('页面中没有找到图片！');
            return;
        }
        
        // 测试下载第一个图片
        const firstImage = images[0];
        const blobUrl = firstImage.src;
        console.log('测试下载图片:', blobUrl);
        
        try {
            const imgData = await this.downloadImageToBase64(blobUrl, 0);
            console.log('图片下载测试结果:', imgData);
            
            if (imgData.data && imgData.data.startsWith('data:image')) {
                alert(`图片下载测试成功！
文件名: ${imgData.filename}
数据大小: ${(imgData.data.length / 1024).toFixed(2)} KB
数据前缀: ${imgData.data.substring(0, 50)}...`);
            } else {
                alert('图片下载测试失败：数据格式不正确');
            }
        } catch (error) {
            console.error('图片下载测试失败:', error);
            alert('图片下载测试失败: ' + error.message);
        }
    }
}

// 导出到全局
window.SelectionMode = SelectionMode; 
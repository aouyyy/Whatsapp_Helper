class InputTranslator {
    constructor() {
        this.isRunning = false;
        this.isEnabled = false;
        this.translationQueue = [];
        this.processingQueue = false;
        this.observer = null;
        this.config = {
            sourceLang: 'zh-CN',
            targetLang: 'en',
            inputSelector: 'div[contenteditable="true"][aria-label="输入消息"]',
            sendButtonSelector: 'button[aria-label="发送"]',
            retryAttempts: 3,
            retryDelay: 1000,
            queueDelay: 500
        };
        
        // 计算器配置
        this.calculatorConfig = {
            triggerSuffix: '==',
            operators: ['+', '-', '*', '/', '(', ')'],
            maxPrecision: 2
        };
        
        // 快捷回复配置
        this.shortcuts = {
            '/help': '需要帮助吗？',
            '/thanks': '谢谢！',
            '/ok': '好的',
            '/bye': '再见！',
            '/busy': '现在很忙，稍后回复',
            '/meeting': '正在开会，稍后联系'
        };
    }

    // 启动服务
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isEnabled = this.getStoredEnabledState();
        
        this.setupInputObserver();
        this.setupKeyboardListener();
        
        console.log('InputTranslator: 输入翻译服务已启动');
    }

    // 停止服务
    stop() {
        this.isRunning = false;
        this.isEnabled = false;
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        console.log('InputTranslator: 输入翻译服务已停止');
    }

    // 切换启用状态
    toggleEnabled() {
        this.isEnabled = !this.isEnabled;
        this.saveEnabledState();
        console.log(`InputTranslator: 翻译功能已${this.isEnabled ? '开启' : '关闭'}`);
    }

    // 获取存储的启用状态
    getStoredEnabledState() {
        try {
            return localStorage.getItem('input_translator_enabled') === 'true';
        } catch (error) {
            return false;
        }
    }

    // 保存启用状态
    saveEnabledState() {
        try {
            localStorage.setItem('input_translator_enabled', this.isEnabled.toString());
        } catch (error) {
            console.error('InputTranslator: 保存状态失败:', error);
        }
    }

    // 设置输入观察器
    setupInputObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const input = mutation.target.closest(this.config.inputSelector);
                    if (input) {
                        this.handleInputChange(input);
                    }
                }
            });
        });

        // 定期检查输入框
        const checkAndObserve = () => {
            const input = document.querySelector(this.config.inputSelector);
            if (input) {
                this.observer.observe(input, {
                    childList: true,
                    characterData: true,
                    subtree: true
                });
            }
        };

        checkAndObserve();
        setInterval(checkAndObserve, 3000);
    }

    // 设置键盘监听器
    setupKeyboardListener() {
        document.addEventListener('keydown', (e) => {
            if (!this.isEnabled || !this.isRunning) return;
            
            const input = e.target.closest(this.config.inputSelector);
            if (!input) return;
            
            const text = input.textContent.trim();
            
            // 处理计算器功能
            if (text.endsWith(this.calculatorConfig.triggerSuffix)) {
                e.preventDefault();
                e.stopPropagation();
                this.handleCalculator(input, text);
                return;
            }
            
            // 处理快捷回复
            if (this.isShortcutCommand(text)) {
                return; // 允许快捷回复直接发送
            }
            
            // 处理翻译（Enter键且包含中文）
            if (e.key === 'Enter' && !e.shiftKey && text && /[\u4e00-\u9fa5]/.test(text)) {
                e.preventDefault();
                e.stopPropagation();
                this.handleTranslation(input, text);
            }
        }, true);
    }

    // 处理输入变化
    handleInputChange(input) {
        if (!this.isEnabled) return;
        
        const text = input.textContent.trim();
        
        // 实时计算器提示
        if (text.endsWith(this.calculatorConfig.triggerSuffix)) {
            this.showCalculatorPreview(input, text);
        }
    }

    // 处理计算器功能
    async handleCalculator(input, text) {
        console.log('InputTranslator: 处理计算器输入:', text);
        
        const result = this.calculateExpression(text);
        if (result !== null) {
            // 显示计算结果
            await this.showCalculationResult(input, text, result);
            
            // 如果结果包含中文且翻译开启，则翻译
            if (/[\u4e00-\u9fa5]/.test(text)) {
                const calculationText = `${text.slice(0, -2)} = ${result}`;
                this.addToTranslationQueue(input, calculationText);
            }
        }
    }

    // 计算表达式（安全版本）
    calculateExpression(expression) {
        try {
            // 移除触发后缀
            expression = expression.replace(new RegExp(this.calculatorConfig.triggerSuffix + '\\s*$'), '').trim();
            
            // 安全检查：只允许数字和基本运算符
            if (!/^[\d+\-*/().\s]+$/.test(expression)) {
                return null;
            }
            
            // 使用安全的计算方法
            const result = this.safeEvaluate(expression);
            
            // 检查结果是否有效
            if (typeof result !== 'number' || !isFinite(result)) {
                return null;
            }
            
            // 格式化结果
            return this.formatNumber(result);
            
        } catch (error) {
            console.error('InputTranslator: 计算错误:', error);
            return null;
        }
    }

    // 安全的表达式求值
    safeEvaluate(expression) {
        // 移除所有空格
        expression = expression.replace(/\s/g, '');
        
        // 检查括号匹配
        if (!this.checkParentheses(expression)) {
            throw new Error('括号不匹配');
        }
        
        // 转换为后缀表达式并计算
        const postfix = this.infixToPostfix(expression);
        return this.evaluatePostfix(postfix);
    }

    // 检查括号匹配
    checkParentheses(expression) {
        const stack = [];
        for (let char of expression) {
            if (char === '(') {
                stack.push(char);
            } else if (char === ')') {
                if (stack.length === 0) return false;
                stack.pop();
            }
        }
        return stack.length === 0;
    }

    // 中缀转后缀
    infixToPostfix(expression) {
        const output = [];
        const operators = [];
        const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
        
        let currentNumber = '';
        
        for (let i = 0; i < expression.length; i++) {
            const char = expression[i];
            
            if (/\d/.test(char) || char === '.') {
                currentNumber += char;
            } else {
                if (currentNumber) {
                    output.push(parseFloat(currentNumber));
                    currentNumber = '';
                }
                
                if (char === '(') {
                    operators.push(char);
                } else if (char === ')') {
                    while (operators.length > 0 && operators[operators.length - 1] !== '(') {
                        output.push(operators.pop());
                    }
                    if (operators.length > 0 && operators[operators.length - 1] === '(') {
                        operators.pop();
                    }
                } else if (['+', '-', '*', '/'].includes(char)) {
                    while (operators.length > 0 && 
                           operators[operators.length - 1] !== '(' && 
                           precedence[operators[operators.length - 1]] >= precedence[char]) {
                        output.push(operators.pop());
                    }
                    operators.push(char);
                }
            }
        }
        
        if (currentNumber) {
            output.push(parseFloat(currentNumber));
        }
        
        while (operators.length > 0) {
            output.push(operators.pop());
        }
        
        return output;
    }

    // 计算后缀表达式
    evaluatePostfix(postfix) {
        const stack = [];
        
        for (let token of postfix) {
            if (typeof token === 'number') {
                stack.push(token);
            } else {
                const b = stack.pop();
                const a = stack.pop();
                
                switch (token) {
                    case '+': stack.push(a + b); break;
                    case '-': stack.push(a - b); break;
                    case '*': stack.push(a * b); break;
                    case '/': 
                        if (b === 0) throw new Error('除数不能为零');
                        stack.push(a / b); 
                        break;
                }
            }
        }
        
        return stack[0];
    }

    // 格式化数字
    formatNumber(num) {
        if (Number.isInteger(num)) {
            return num.toString();
        }
        return num.toFixed(this.calculatorConfig.maxPrecision).replace(/\.?0+$/, '');
    }

    // 显示计算器预览
    showCalculatorPreview(input, text) {
        const result = this.calculateExpression(text);
        if (result !== null) {
            this.showHint(`计算结果: ${result}`, 'calculator');
        }
    }

    // 显示计算结果
    async showCalculationResult(input, text, result) {
        const calculationText = `${text.slice(0, -2)} = ${result}`;
        
        // 显示结果提示
        this.showHint(`计算结果: ${result}`, 'calculator');
        
        // 更新输入框内容
        await this.updateInputContent(input, calculationText);
        
        // 3秒后隐藏提示
        setTimeout(() => {
            this.hideHint('calculator');
        }, 3000);
    }

    // 处理翻译
    async handleTranslation(input, text) {
        console.log('InputTranslator: 处理翻译输入:', text);
        this.addToTranslationQueue(input, text);
    }

    // 添加到翻译队列
    addToTranslationQueue(input, text) {
        this.translationQueue.push({ input, text });
        console.log(`InputTranslator: 添加到翻译队列，当前长度: ${this.translationQueue.length}`);
        
        if (!this.processingQueue) {
            this.processTranslationQueue();
        }
    }

    // 处理翻译队列
    async processTranslationQueue() {
        if (this.processingQueue || this.translationQueue.length === 0) {
            return;
        }

        this.processingQueue = true;
        console.log(`InputTranslator: 开始处理翻译队列，共 ${this.translationQueue.length} 个任务`);

        while (this.translationQueue.length > 0) {
            const { input, text } = this.translationQueue.shift();
            
            try {
                const translatedText = await this.translateText(text);
                if (translatedText && translatedText !== text) {
                    await this.updateInputContent(input, translatedText);
                    this.showHint('翻译完成', 'translation');
                }
            } catch (error) {
                console.error('InputTranslator: 翻译失败:', error);
                this.showHint('翻译失败', 'error');
            }
            
            // 延迟避免请求过于频繁
            await new Promise(resolve => setTimeout(resolve, this.config.queueDelay));
        }

        this.processingQueue = false;
        console.log('InputTranslator: 翻译队列处理完成');
    }

    // 翻译文本
    async translateText(text) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${this.config.sourceLang}&tl=${this.config.targetLang}&dt=t&q=${encodeURIComponent(text)}`;

        return new Promise((resolve, reject) => {
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
                resolve(translatedText);
            })
            .catch(error => {
                console.error('InputTranslator: 翻译请求失败:', error);
                reject(error);
            });
        });
    }

    // 更新输入框内容
    async updateInputContent(input, text) {
        return new Promise((resolve) => {
            try {
                // 创建观察器防止内容被重复添加
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'characterData' || mutation.type === 'childList') {
                            const currentText = input.textContent.trim();
                            if (currentText !== text && currentText.includes(text)) {
                                mutation.target.textContent = text;
                            }
                        }
                    });
                });

                observer.observe(input, {
                    childList: true,
                    characterData: true,
                    subtree: true
                });

                // 更新内容
                const p = input.querySelector('p');
                if (p) {
                    // 保存原始样式
                    const originalClass = p.className;
                    const originalStyle = p.getAttribute('style');

                    // 清空并重建内容
                    p.innerHTML = '';
                    const span = document.createElement('span');
                    span.className = 'selectable-text copyable-text';
                    span.setAttribute('data-lexical-text', 'true');
                    span.textContent = text;
                    p.appendChild(span);

                    // 恢复样式
                    p.className = originalClass;
                    if (originalStyle) {
                        p.setAttribute('style', originalStyle);
                    }

                    // 触发事件
                    const events = [
                        new InputEvent('beforeinput', {
                            inputType: 'insertText',
                            data: text,
                            bubbles: true,
                            cancelable: true
                        }),
                        new Event('input', { bubbles: true })
                    ];

                    events.forEach(event => input.dispatchEvent(event));
                }

                // 验证更新
                setTimeout(() => {
                    observer.disconnect();
                    const currentText = input.textContent.trim();
                    resolve(currentText === text);
                }, 100);

            } catch (error) {
                console.error('InputTranslator: 更新内容失败:', error);
                resolve(false);
            }
        });
    }

    // 检查是否为快捷回复命令
    isShortcutCommand(text) {
        return text.startsWith('/') && text.length > 1 && !text.includes(' ');
    }

    // 显示提示
    showHint(message, type = 'info') {
        this.hideHint(type);
        
        const hint = document.createElement('div');
        hint.id = `translator-hint-${type}`;
        hint.textContent = message;
        hint.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#ff4444' : type === 'calculator' ? '#00a884' : '#333'};
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-family: system-ui;
            font-size: 14px;
            z-index: 10001;
            animation: fadeIn 0.3s;
        `;
        
        document.body.appendChild(hint);
    }

    // 隐藏提示
    hideHint(type) {
        const hint = document.querySelector(`#translator-hint-${type}`);
        if (hint) {
            hint.remove();
        }
    }

    // 获取服务状态
    getStatus() {
        return {
            isRunning: this.isRunning,
            isEnabled: this.isEnabled,
            queueLength: this.translationQueue.length,
            isProcessingQueue: this.processingQueue
        };
    }
}

// 导出到全局作用域
window.InputTranslator = InputTranslator; 
import * as assert from 'assert';
import {
    sanitizeHtml,
    escapeHtml,
    countActiveFilters,
    getNonce
} from '../../webview/utils';

suite('Utils Test Suite', () => {
    suite('sanitizeHtml', () => {
        test('should allow basic HTML tags', () => {
            const input = '<p>Hello <strong>World</strong></p>';
            const result = sanitizeHtml(input);

            assert.ok(result.includes('<p>'), 'Should allow p tag');
            assert.ok(result.includes('<strong>'), 'Should allow strong tag');
            assert.ok(result.includes('Hello'), 'Should keep text content');
        });

        test('should allow headers', () => {
            const input = '<h1>Title</h1><h2>Subtitle</h2>';
            const result = sanitizeHtml(input);

            assert.ok(result.includes('<h1>Title</h1>'), 'Should allow h1');
            assert.ok(result.includes('<h2>Subtitle</h2>'), 'Should allow h2');
        });

        test('should allow links with safe attributes', () => {
            const input = '<a href="https://example.com" title="Link">Click</a>';
            const result = sanitizeHtml(input);

            assert.ok(result.includes('href="https://example.com"'), 'Should allow https href');
            assert.ok(result.includes('title="Link"'), 'Should allow title');
        });

        test('should remove script tags', () => {
            const input = '<p>Hello</p><script>alert("xss")</script>';
            const result = sanitizeHtml(input);

            assert.ok(!result.includes('<script>'), 'Should remove script tag');
            assert.ok(!result.includes('alert'), 'Should remove script content');
            assert.ok(result.includes('Hello'), 'Should keep safe content');
        });

        test('should remove event handlers', () => {
            const input = '<div onclick="alert(1)">Click me</div>';
            const result = sanitizeHtml(input);

            assert.ok(!result.includes('onclick'), 'Should remove onclick');
            assert.ok(result.includes('Click me'), 'Should keep text content');
        });

        test('should remove javascript: URLs', () => {
            const input = '<a href="javascript:alert(1)">Bad Link</a>';
            const result = sanitizeHtml(input);

            assert.ok(!result.includes('javascript:'), 'Should remove javascript: URL');
        });

        test('should allow safe image tags', () => {
            const input = '<img src="https://example.com/img.png" alt="Image">';
            const result = sanitizeHtml(input);

            assert.ok(result.includes('src="https://example.com/img.png"'), 'Should allow https image');
            assert.ok(result.includes('alt="Image"'), 'Should allow alt attribute');
        });

        test('should allow code blocks', () => {
            const input = '<pre><code>const x = 1;</code></pre>';
            const result = sanitizeHtml(input);

            assert.ok(result.includes('<pre>'), 'Should allow pre tag');
            assert.ok(result.includes('<code>'), 'Should allow code tag');
        });

        test('should allow lists', () => {
            const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
            const result = sanitizeHtml(input);

            assert.ok(result.includes('<ul>'), 'Should allow ul tag');
            assert.ok(result.includes('<li>'), 'Should allow li tag');
        });

        test('should allow tables', () => {
            const input = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
            const result = sanitizeHtml(input);

            assert.ok(result.includes('<table>'), 'Should allow table tag');
            assert.ok(result.includes('<th>'), 'Should allow th tag');
            assert.ok(result.includes('<td>'), 'Should allow td tag');
        });

        test('should remove style tags', () => {
            const input = '<style>body{color:red}</style><p>Text</p>';
            const result = sanitizeHtml(input);

            assert.ok(!result.includes('<style>'), 'Should remove style tag');
            assert.ok(result.includes('<p>Text</p>'), 'Should keep safe content');
        });

        test('should remove iframe tags', () => {
            const input = '<iframe src="https://evil.com"></iframe><p>Text</p>';
            const result = sanitizeHtml(input);

            assert.ok(!result.includes('<iframe>'), 'Should remove iframe tag');
            assert.ok(result.includes('<p>Text</p>'), 'Should keep safe content');
        });

        test('should handle empty input', () => {
            const result = sanitizeHtml('');
            assert.strictEqual(result, '');
        });
    });

    suite('escapeHtml', () => {
        test('should escape ampersand', () => {
            assert.strictEqual(escapeHtml('A & B'), 'A &amp; B');
        });

        test('should escape less than', () => {
            assert.strictEqual(escapeHtml('a < b'), 'a &lt; b');
        });

        test('should escape greater than', () => {
            assert.strictEqual(escapeHtml('a > b'), 'a &gt; b');
        });

        test('should escape double quotes', () => {
            assert.strictEqual(escapeHtml('say "hello"'), 'say &quot;hello&quot;');
        });

        test('should escape single quotes', () => {
            assert.strictEqual(escapeHtml("it's"), "it&#039;s");
        });

        test('should escape all special characters together', () => {
            const input = '<script>alert("xss" && \'test\')</script>';
            const result = escapeHtml(input);

            assert.ok(!result.includes('<'), 'Should escape <');
            assert.ok(!result.includes('>'), 'Should escape >');
            assert.ok(!result.includes('"'), 'Should escape "');
            assert.ok(!result.includes("'"), 'Should escape \'');
        });

        test('should not modify safe text', () => {
            const input = 'Hello World 123';
            assert.strictEqual(escapeHtml(input), input);
        });

        test('should handle empty string', () => {
            assert.strictEqual(escapeHtml(''), '');
        });
    });

    suite('countActiveFilters', () => {
        const defaultStatuses = ['未着手', '着手中'];

        test('should return 0 when no filter options', () => {
            assert.strictEqual(countActiveFilters(undefined), 0);
        });

        test('should return 0 for empty filter options', () => {
            assert.strictEqual(countActiveFilters({}, defaultStatuses), 0);
        });

        test('should count searchText', () => {
            const result = countActiveFilters({ searchText: 'test' }, defaultStatuses);
            assert.strictEqual(result, 1);
        });

        test('should count versionId', () => {
            const result = countActiveFilters({ versionId: '1' }, defaultStatuses);
            assert.strictEqual(result, 1);
        });

        test('should count assigneeId', () => {
            const result = countActiveFilters({ assigneeId: '5' }, defaultStatuses);
            assert.strictEqual(result, 1);
        });

        test('should count trackerType', () => {
            const result = countActiveFilters({ trackerType: 'Task' }, defaultStatuses);
            assert.strictEqual(result, 1);
        });

        test('should not count hideEmptyHierarchy when true (default)', () => {
            // hideEmptyHierarchy のデフォルトは true なので、true の場合はカウントしない
            const result = countActiveFilters({ hideEmptyHierarchy: true }, defaultStatuses);
            assert.strictEqual(result, 0);
        });

        test('should not count default statuses', () => {
            const result = countActiveFilters(
                { selectedStatuses: ['未着手', '着手中'] },
                defaultStatuses
            );
            assert.strictEqual(result, 0);
        });

        test('should count non-default statuses', () => {
            const result = countActiveFilters(
                { selectedStatuses: ['クローズ'] },
                defaultStatuses
            );
            assert.strictEqual(result, 1);
        });

        test('should count multiple active filters', () => {
            // hideEmptyHierarchy: true はデフォルトなのでカウントしない → 5つ
            const result = countActiveFilters(
                {
                    searchText: 'test',
                    versionId: '1',
                    assigneeId: '5',
                    trackerType: 'Bug',
                    hideEmptyHierarchy: true,
                    selectedStatuses: ['クローズ']
                },
                defaultStatuses
            );
            assert.strictEqual(result, 5);
        });

        test('should count hideEmptyHierarchy when false (non-default)', () => {
            // hideEmptyHierarchy: false はデフォルトから変更されているのでカウント
            const result = countActiveFilters({ hideEmptyHierarchy: false }, defaultStatuses);
            assert.strictEqual(result, 1);
        });
    });

    suite('getNonce', () => {
        test('should return a string', () => {
            const nonce = getNonce();
            assert.strictEqual(typeof nonce, 'string');
        });

        test('should return non-empty string', () => {
            const nonce = getNonce();
            assert.ok(nonce.length > 0, 'Nonce should not be empty');
        });

        test('should return base64url encoded string', () => {
            const nonce = getNonce();
            // base64url uses A-Z, a-z, 0-9, -, _
            const validChars = /^[A-Za-z0-9_-]+$/;
            assert.ok(validChars.test(nonce), 'Should be valid base64url');
        });

        test('should return different values each time', () => {
            const nonce1 = getNonce();
            const nonce2 = getNonce();
            const nonce3 = getNonce();

            assert.notStrictEqual(nonce1, nonce2, 'Should generate unique nonces');
            assert.notStrictEqual(nonce2, nonce3, 'Should generate unique nonces');
            assert.notStrictEqual(nonce1, nonce3, 'Should generate unique nonces');
        });

        test('should return appropriate length', () => {
            const nonce = getNonce();
            // 24 bytes in base64url = 32 characters
            assert.strictEqual(nonce.length, 32, 'Should be 32 characters (24 bytes base64url)');
        });
    });
});

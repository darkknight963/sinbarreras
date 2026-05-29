# CI/CD Integration Guide for Visual Regression Testing

This guide explains how to integrate the visual regression testing framework into your CI/CD pipeline.

## GitHub Actions Integration

### Basic Setup

Create `.github/workflows/visual-regression-tests.yml`:

```yaml
name: Visual Regression Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  visual-tests:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Build application
        run: npm run build
      
      - name: Run visual regression tests
        run: npm run test:visual
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
      
      - name: Upload test results JSON
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
          retention-days: 30
      
      - name: Comment PR with test results
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('test-results/results.json', 'utf8'));
            const passed = results.stats.expected;
            const failed = results.stats.unexpected;
            const skipped = results.stats.skipped;
            
            const comment = `## Visual Regression Test Results
            
            - ✅ Passed: ${passed}
            - ❌ Failed: ${failed}
            - ⏭️ Skipped: ${skipped}
            
            [View detailed report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### Advanced Setup with Baseline Management

For managing baseline snapshots across branches:

```yaml
name: Visual Regression Tests with Baseline Management

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  visual-tests:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Build application
        run: npm run build
      
      - name: Download baseline snapshots
        uses: actions/download-artifact@v4
        with:
          name: baseline-snapshots
          path: src/tests/visual/__screenshots__/
        continue-on-error: true
      
      - name: Run visual regression tests
        run: npm run test:visual
        continue-on-error: true
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
      
      - name: Upload baseline snapshots
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: baseline-snapshots
          path: src/tests/visual/__screenshots__/
          retention-days: 90
      
      - name: Check for visual regressions
        if: failure()
        run: |
          echo "Visual regression tests failed!"
          echo "Review the detailed report in the artifacts."
          exit 1
```

## GitLab CI Integration

Create `.gitlab-ci.yml`:

```yaml
visual-regression-tests:
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  stage: test
  
  before_script:
    - npm ci
    - npx playwright install --with-deps
  
  script:
    - npm run build
    - npm run test:visual
  
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
    reports:
      junit: test-results/junit.xml
    expire_in: 30 days
  
  allow_failure: false
```

## Jenkins Integration

Create `Jenkinsfile`:

```groovy
pipeline {
  agent any
  
  stages {
    stage('Setup') {
      steps {
        sh 'npm ci'
        sh 'npx playwright install --with-deps'
      }
    }
    
    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }
    
    stage('Visual Regression Tests') {
      steps {
        sh 'npm run test:visual'
      }
    }
  }
  
  post {
    always {
      junit 'test-results/junit.xml'
      publishHTML([
        reportDir: 'playwright-report',
        reportFiles: 'index.html',
        reportName: 'Playwright Report'
      ])
      archiveArtifacts artifacts: 'test-results/**', allowEmptyArchive: true
    }
    
    failure {
      echo 'Visual regression tests failed!'
    }
  }
}
```

## Environment Variables

Set these environment variables in your CI/CD system:

```bash
# Enable CI mode (retries, parallel workers)
CI=true

# Skip browser download (use pre-installed browsers)
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Set base URL for tests
PLAYWRIGHT_TEST_BASE_URL=http://localhost:5173

# Enable trace collection
PLAYWRIGHT_TRACE=on-first-retry

# Set screenshot on failure
PLAYWRIGHT_SCREENSHOT=only-on-failure
```

## Docker Integration

Create `Dockerfile.test`:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && npx playwright install --with-deps

# Copy application code
COPY . .

# Build application
RUN npm run build

# Run visual regression tests
CMD ["npm", "run", "test:visual"]
```

Build and run:

```bash
docker build -f Dockerfile.test -t visual-regression-tests .
docker run --rm -v $(pwd)/playwright-report:/app/playwright-report visual-regression-tests
```

## Baseline Management Strategy

### Option 1: Store Baselines in Repository

Pros:
- Simple setup
- No external dependencies
- Easy to review changes

Cons:
- Large repository size
- Difficult to manage across branches

Implementation:
```bash
# Commit baseline snapshots
git add src/tests/visual/__screenshots__/
git commit -m "Update visual regression baselines"
```

### Option 2: Store Baselines in Artifact Repository

Pros:
- Smaller repository size
- Easy to manage versions
- Better for large projects

Cons:
- Requires artifact storage
- More complex setup

Implementation:
```yaml
# In CI/CD pipeline
- name: Upload baselines to artifact repository
  run: |
    curl -X POST \
      -H "Authorization: Bearer $ARTIFACT_TOKEN" \
      -F "file=@src/tests/visual/__screenshots__/" \
      $ARTIFACT_REPOSITORY_URL
```

### Option 3: Store Baselines in Cloud Storage

Pros:
- Scalable
- Easy to share
- Good for distributed teams

Cons:
- Requires cloud setup
- Additional costs

Implementation:
```yaml
# In CI/CD pipeline
- name: Upload baselines to S3
  run: |
    aws s3 sync src/tests/visual/__screenshots__/ \
      s3://my-bucket/baselines/ \
      --delete
```

## Handling Baseline Updates

### Automatic Baseline Updates on Main Branch

```yaml
- name: Update baselines on main branch
  if: github.ref == 'refs/heads/main' && failure()
  run: |
    npm run test:visual:update
    git config user.name "CI Bot"
    git config user.email "ci@example.com"
    git add src/tests/visual/__screenshots__/
    git commit -m "Update visual regression baselines [skip ci]"
    git push
```

### Manual Baseline Updates via PR Comment

```yaml
- name: Update baselines on comment
  if: github.event.issue.pull_request && contains(github.event.comment.body, '@bot update-baselines')
  run: |
    npm run test:visual:update
    git config user.name "CI Bot"
    git config user.email "ci@example.com"
    git add src/tests/visual/__screenshots__/
    git commit -m "Update visual regression baselines"
    git push
```

## Monitoring and Alerts

### Slack Notifications

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Visual regression tests failed",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Visual regression tests failed in ${{ github.repository }}\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View details>"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Email Notifications

```yaml
- name: Send email notification
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: ${{ secrets.EMAIL_SERVER }}
    server_port: ${{ secrets.EMAIL_PORT }}
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: Visual regression tests failed
    to: team@example.com
    from: ci@example.com
    body: |
      Visual regression tests failed in ${{ github.repository }}
      
      View details: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

## Performance Optimization

### Parallel Test Execution

```yaml
- name: Run visual regression tests in parallel
  run: npm run test:visual -- --workers=4
```

### Selective Test Execution

```yaml
- name: Run tests for changed files only
  run: |
    CHANGED_FILES=$(git diff --name-only origin/main...HEAD)
    for file in $CHANGED_FILES; do
      if [[ $file == src/components/* ]]; then
        npm run test:visual -- --grep "$(basename $file)"
      fi
    done
```

### Caching

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v3
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-playwright-
```

## Troubleshooting

### Tests timeout in CI

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60 * 1000, // 60 seconds
```

### Baseline mismatch in CI

Ensure consistent environment:
```yaml
- name: Set consistent environment
  run: |
    export TZ=UTC
    export LANG=en_US.UTF-8
```

### Browser crashes in CI

Use headless mode and increase memory:
```yaml
- name: Run tests with increased memory
  run: npm run test:visual
  env:
    NODE_OPTIONS: --max-old-space-size=4096
```

## Best Practices

1. **Run tests on every push** - Catch regressions early
2. **Require passing tests for PR merge** - Enforce quality
3. **Review baseline changes** - Ensure intentional updates
4. **Monitor test performance** - Track execution time
5. **Archive reports** - Keep history for analysis
6. **Use consistent environment** - Avoid flaky tests
7. **Document changes** - Explain why baselines changed
8. **Automate baseline updates** - Reduce manual work

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitLab CI Documentation](https://docs.gitlab.com/ee/ci/)
- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [Playwright CI Guide](https://playwright.dev/docs/ci)

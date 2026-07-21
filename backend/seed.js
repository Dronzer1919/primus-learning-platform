require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const LanguageTab = require('./src/models/LanguageTab');
const Topic = require('./src/models/Topic');

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await LanguageTab.deleteMany({});
    await Topic.deleteMany({});

    // Create admin user
    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin'
    });
    console.log('Admin user created:', admin.username);

    // Create regular user
    console.log('Creating regular user...');
    const userPassword = await bcrypt.hash('user123', 10);
    const user = await User.create({
      username: 'testuser',
      email: 'user@example.com',
      password: userPassword,
      role: 'user'
    });
    console.log('Regular user created:', user.username);

    // Create language tabs
    console.log('Creating language tabs...');
    const languageTabs = await LanguageTab.insertMany([
      { name: 'HTML', code: 'html', order: 1, isActive: true },
      { name: 'CSS', code: 'css', order: 2, isActive: true },
      { name: 'JavaScript', code: 'javascript', order: 3, isActive: true },
      { name: 'TypeScript', code: 'typescript', order: 4, isActive: true },
      { name: 'SCSS', code: 'scss', order: 5, isActive: true }
    ]);
    console.log(`Created ${languageTabs.length} language tabs`);

    // Create sample HTML topic
    console.log('Creating sample topics...');
    const htmlTopic = await Topic.create({
      title: 'HTML Basics',
      description: 'Learn the fundamentals of HTML',
      difficultyLevel: 'beginner',
      languagePlatform: 'html',
      order: 1,
      subtopics: [
        {
          title: 'HTML Structure',
          order: 1,
          content: [
            {
              type: 'description',
              order: 1,
              data: {
                text: '<h2>HTML Document Structure</h2><p>Every HTML document follows a basic structure. Understanding this structure is essential for creating web pages.</p>'
              }
            },
            {
              type: 'code',
              order: 2,
              data: {
                language: 'html',
                code: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My First Page</title>\n</head>\n<body>\n  <h1>Hello World!</h1>\n  <p>This is my first HTML page.</p>\n</body>\n</html>',
                title: 'Basic HTML Template'
              }
            },
            {
              type: 'description',
              order: 3,
              data: {
                text: '<p>The <code>&lt;!DOCTYPE html&gt;</code> declaration defines the document type and HTML version.</p>'
              }
            }
          ]
        },
        {
          title: 'HTML Tags',
          order: 2,
          content: [
            {
              type: 'description',
              order: 1,
              data: {
                text: '<h2>Common HTML Tags</h2><p>HTML uses tags to mark up content. Here are some of the most common tags you\'ll use:</p><ul><li><strong>&lt;h1&gt; to &lt;h6&gt;</strong> - Headings</li><li><strong>&lt;p&gt;</strong> - Paragraphs</li><li><strong>&lt;a&gt;</strong> - Links</li><li><strong>&lt;img&gt;</strong> - Images</li><li><strong>&lt;div&gt;</strong> - Container</li></ul>'
              }
            },
            {
              type: 'code',
              order: 2,
              data: {
                language: 'html',
                code: '<h1>This is a heading</h1>\n<p>This is a paragraph.</p>\n<a href="https://example.com">This is a link</a>\n<img src="image.jpg" alt="Description">\n<div>\n  <p>Content inside a div container</p>\n</div>',
                title: 'Common HTML Tags Example'
              }
            }
          ]
        }
      ]
    });

    // Create sample CSS topic
    const cssTopic = await Topic.create({
      title: 'CSS Fundamentals',
      description: 'Master the basics of CSS styling',
      difficultyLevel: 'beginner',
      languagePlatform: 'css',
      order: 1,
      subtopics: [
        {
          title: 'CSS Selectors',
          order: 1,
          content: [
            {
              type: 'description',
              order: 1,
              data: {
                text: '<h2>Understanding CSS Selectors</h2><p>CSS selectors are patterns used to select the elements you want to style.</p>'
              }
            },
            {
              type: 'code',
              order: 2,
              data: {
                language: 'css',
                code: '/* Element Selector */\np {\n  color: blue;\n}\n\n/* Class Selector */\n.highlight {\n  background-color: yellow;\n}\n\n/* ID Selector */\n#header {\n  font-size: 24px;\n}\n\n/* Descendant Selector */\ndiv p {\n  margin: 10px;\n}',
                title: 'CSS Selector Examples'
              }
            }
          ]
        },
        {
          title: 'CSS Box Model',
          order: 2,
          content: [
            {
              type: 'description',
              order: 1,
              data: {
                text: '<h2>The CSS Box Model</h2><p>Every element in CSS is essentially a box. The box model consists of:</p><ul><li>Content</li><li>Padding</li><li>Border</li><li>Margin</li></ul>'
              }
            },
            {
              type: 'code',
              order: 2,
              data: {
                language: 'css',
                code: '.box {\n  width: 300px;\n  height: 200px;\n  padding: 20px;\n  border: 2px solid black;\n  margin: 10px;\n}',
                title: 'Box Model Example'
              }
            }
          ]
        }
      ]
    });

    // Create sample JavaScript topic
    const jsTopic = await Topic.create({
      title: 'JavaScript Basics',
      description: 'Learn JavaScript programming fundamentals',
      difficultyLevel: 'beginner',
      languagePlatform: 'javascript',
      order: 1,
      subtopics: [
        {
          title: 'Variables and Data Types',
          order: 1,
          content: [
            {
              type: 'description',
              order: 1,
              data: {
                text: '<h2>JavaScript Variables</h2><p>Variables are containers for storing data values. JavaScript has three ways to declare variables:</p><ul><li><code>var</code> - Function-scoped (legacy)</li><li><code>let</code> - Block-scoped (modern)</li><li><code>const</code> - Block-scoped constant</li></ul>'
              }
            },
            {
              type: 'code',
              order: 2,
              data: {
                language: 'javascript',
                code: '// String\nlet name = "John";\nconst greeting = "Hello";\n\n// Number\nlet age = 25;\nlet price = 19.99;\n\n// Boolean\nlet isActive = true;\nlet isLoggedIn = false;\n\n// Array\nlet colors = ["red", "green", "blue"];\n\n// Object\nlet person = {\n  name: "Alice",\n  age: 30,\n  city: "New York"\n};',
                title: 'Variable Declaration Examples'
              }
            }
          ]
        },
        {
          title: 'Functions',
          order: 2,
          content: [
            {
              type: 'description',
              order: 1,
              data: {
                text: '<h2>JavaScript Functions</h2><p>Functions are reusable blocks of code that perform specific tasks.</p>'
              }
            },
            {
              type: 'code',
              order: 2,
              data: {
                language: 'javascript',
                code: '// Function Declaration\nfunction greet(name) {\n  return "Hello, " + name + "!";\n}\n\n// Arrow Function (ES6)\nconst add = (a, b) => {\n  return a + b;\n};\n\n// Shorter Arrow Function\nconst multiply = (a, b) => a * b;\n\n// Using functions\nconsole.log(greet("John"));  // "Hello, John!"\nconsole.log(add(5, 3));      // 8\nconsole.log(multiply(4, 2)); // 8',
                title: 'Function Examples'
              }
            }
          ]
        }
      ]
    });

    console.log(`Created ${3} sample topics with subtopics and content`);

    console.log('\n=================================');
    console.log('Seed data created successfully!');
    console.log('=================================');
    console.log('\nTest Credentials:');
    console.log('Admin - username: admin, password: admin123');
    console.log('User  - username: testuser, password: user123');
    console.log('\nYou can now:');
    console.log('1. Start the backend: npm run dev');
    console.log('2. Login with test credentials');
    console.log('3. View topics and content in the user panel');
    console.log('4. Manage content in the admin panel');

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();

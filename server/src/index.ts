import express from 'express';
import cors from 'cors';
import { Sequelize, DataTypes, Model, Op } from 'sequelize';
// GraphQL関連のインポート
import { graphqlHTTP } from 'express-graphql';
import { 
  GraphQLSchema, 
  GraphQLObjectType, 
  GraphQLList, 
  GraphQLString, 
  GraphQLInt, 
  GraphQLID 
} from 'graphql';

const app = express();
const PORT = 3010;

app.use(cors());
app.use(express.json());

// --- DB設定 (変更なし) ---
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

class Task extends Model {}
Task.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  due_date: { type: DataTypes.DATEONLY },
  location: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
}, { sequelize, modelName: 'Task' });

class Tag extends Model {}
Tag.init({
  name: { type: DataTypes.STRING, unique: true, allowNull: false }
}, { sequelize, modelName: 'Tag', timestamps: false });

Task.belongsToMany(Tag, { through: 'TaskTags' });
Tag.belongsToMany(Task, { through: 'TaskTags' });

const init = async () => {
  await sequelize.sync({ force: true });
  // 初期データ (変更なし)
  const tasks = await Task.bulkCreate([
    { title: '牛乳を買う', description: 'スーパーで牛乳と卵を買う', due_date: '2026-01-21', location: '近所のスーパー', status: 'pending' },
    { title: 'レポート提出', description: '月曜日の朝までに提出', due_date: '2026-01-26', location: '大学', status: 'completed' },
    { title: 'ランニング', description: '公園を5km走る', due_date: '2026-01-22', location: '中央公園', status: 'pending' },
    { title: '図書館へ返却', description: '借りていた技術書と小説を返す', due_date: '2026-01-22', location: '市立図書館', status: 'pending' },
    { title: '歯医者の定期検診', description: '午後3時に予約、保険証を忘れない', due_date: '2026-01-24', location: '駅前歯科クリニック', status: 'pending' },
    // { title: 'チームミーティング', description: 'プロジェクトの進捗報告と課題共有', due_date: '2026-01-20', location: 'オンライン (Zoom)', status: 'completed' },
    // { title: '電気代の支払い', description: 'コンビニで1月分の支払いを済ませる', due_date: '2026-01-25', location: 'セブンイレブン', status: 'pending' },
    // { title: '誕生日プレゼント購入', description: '友人のためにコーヒーメーカーを探す', due_date: '2026-01-23', location: 'ショッピングモール', status: 'pending' },
    // { title: '洗車', description: '週末のドライブに備えて洗車機にかける', due_date: '2026-01-18', location: 'ガソリンスタンド', status: 'completed' },
    // { title: 'プログラミング学習', description: 'Pythonのデータ分析チュートリアルを1章進める', due_date: '2026-01-30', location: '自宅', status: 'pending' },
    // { title: 'ライブチケット予約', description: '先行抽選の申し込み締め切り', due_date: '2026-01-21', location: 'チケットサイト', status: 'pending' },
    // { title: '粗大ゴミの申込み', description: '古い椅子の回収を依頼する', due_date: '2026-01-28', location: '市役所HP', status: 'pending' },
    // { title: 'ディナーの予約', description: '週末の食事会の席を確保する', due_date: '2026-01-19', location: 'イタリアンレストラン', status: 'completed' },
  ]);
  const tags = await Tag.bulkCreate([{ name: '買い物' }, { name: '家事' }, { name: '大学' }, { name: '健康' }]);
  await (tasks[0] as any).addTags([tags[0], tags[1]]);
  await (tasks[1] as any).addTags([tags[2]]);
  await (tasks[2] as any).addTags([tags[3]]);
  console.log('Database initialized.');
};
init();

// --- GraphQL Schema 定義 ---

// Tag Type
const TagType = new GraphQLObjectType({
  name: 'Tag',
  fields: () => ({
    name: { type: GraphQLString }
  })
});

// Task Type
const TaskType = new GraphQLObjectType({
  name: 'Task',
  fields: () => ({
    id: { type: GraphQLInt },
    title: { type: GraphQLString },
    description: { type: GraphQLString },
    due_date: { type: GraphQLString },
    location: { type: GraphQLString },
    status: { type: GraphQLString },
    createdAt: { type: GraphQLString },
    updatedAt: { type: GraphQLString },
    // Tagsのリレーション解決
    tags: {
      type: new GraphQLList(TagType),
      resolve(parent: any) {
        // Sequelizeのインスタンスメソッドを使って取得、あるいは親に含まれているデータを使用
        return parent.Tags || parent.getTags();
      }
    }
    // ※ ここに createdAt, updatedAt を定義していないため、
    //    クライアントが要求しても物理的に取得できなくなり、オーバーフェッチが解決します。
  })
});

// Root Query
const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    tasks: {
      type: new GraphQLList(TaskType),
      args: {
        q: { type: GraphQLString },   // キーワード検索用
        tag: { type: GraphQLString }  // タグ絞り込み用
      },
      async resolve(parent, args) {
        const { q, tag } = args;
        const whereClause: any = {};
        const includeClause: any = [
          {
            model: Tag,
            attributes: ['name'],
            through: { attributes: [] } // 中間テーブル除外
          }
        ];

        // キーワード検索
        if (q) {
          whereClause[Op.or] = [
            { title: { [Op.like]: `%${q}%` } },
            { description: { [Op.like]: `%${q}%` } },
            { location: { [Op.like]: `%${q}%` } }
          ];
        }

        // タグ検索（include側で絞り込む）
        if (tag) {
          // Sequelizeの仕様上、多対多の絞り込みは少し複雑ですが、
          // 簡易的に「指定したタグを含むもの」を取得します
          includeClause[0].where = { name: tag };
        }

        // ここで一括取得 (Eager Loading)
        // DBレベルでもN+1を防ぐため include を使います
        const tasks = await Task.findAll({
          where: whereClause,
          include: includeClause,
          order: [['due_date', 'ASC']]
        });
        
        return tasks;
      }
    }
  }
});

const schema = new GraphQLSchema({
  query: RootQuery
});

// --- API エンドポイント ---

// GraphQL エンドポイント
app.use('/graphql', graphqlHTTP({
  schema,
  graphiql: true, // ブラウザでテストできるGUIを有効化 (http://localhost:3010/graphql)
}));


// --- REST API (Mutation用: Create, Update, Delete は既存のまま維持) ---

app.post('/tasks', async (req, res) => {
  try {
    const { title, description, due_date, location, tags } = req.body;
    const task = await Task.create({ title, description, due_date, location });
    if (tags && Array.isArray(tags)) {
      for (const tagName of tags) {
        const [tag] = await Tag.findOrCreate({ where: { name: tagName } });
        await (task as any).addTag(tag);
      }
    }
    res.json(task);
  } catch (e) { res.status(500).json({ error: 'Create failed' }); }
});

app.put('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    const { title, description, status, due_date, location, tags } = req.body;
    task.set({ title, description, status, due_date, location });
    await task.save();
    if (tags && Array.isArray(tags)) {
      await (task as any).setTags([]); 
      for (const tagName of tags) {
        const [tag] = await Tag.findOrCreate({ where: { name: tagName } });
        await (task as any).addTag(tag);
      }
    }
    res.json(task);
  } catch (e) { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    await Task.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Delete failed' }); }
});

app.listen(PORT, () => console.log(`http://localhost:${PORT}/graphql`));